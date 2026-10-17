import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import {
  CreatePlanDto,
  AssignSubscriptionDto,
  Role,
  SubscriptionStatus,
} from '@chatpilot/contracts';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPlan(callerCtx: InteractiveAuthContext, dto: CreatePlanDto) {
    if (callerCtx.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can create subscription plans');
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.plan.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Plan with code "${code}" already exists`);
    }

    return this.prisma.plan.create({
      data: {
        code,
        name: dto.name.trim(),
        limits: dto.limits as any,
      },
    });
  }

  async assignSubscription(callerCtx: InteractiveAuthContext, dto: AssignSubscriptionDto) {
    if (callerCtx.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can assign company subscriptions');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Deactivate prior subscriptions
    await this.prisma.subscription.updateMany({
      where: { companyId: dto.companyId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED },
    });

    // Create fresh subscription for 30 days
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.create({
      data: {
        companyId: dto.companyId,
        planId: dto.planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });
  }
}
