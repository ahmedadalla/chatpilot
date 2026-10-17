import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { CompanyUsageViewDto, Role } from '@chatpilot/contracts';

export class PlanLimitExceededException extends HttpException {
  constructor(message: string) {
    super(
      {
        code: 'PLAN_LIMIT_EXCEEDED',
        message,
        upgradeUrl: '/billing/plans',
      },
      HttpStatus.PAYMENT_REQUIRED, // 402
    );
  }
}

@Injectable()
export class UsageLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pre-action check: verifies company has not exceeded monthly order quota (ARCHITECTURE.md §10.2).
   * Throws 402 Payment Required if limit exceeded.
   */
  async checkOrderLimit(companyId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      // Default basic limits if no explicit subscription assigned
      return;
    }

    const limits = subscription.plan.limits as Record<string, any>;
    const ordersPerMonth = Number(limits['ordersPerMonth'] || 0);

    if (ordersPerMonth <= 0) {
      return; // Unlimited
    }

    // Current month start
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthOrders = await this.prisma.usageEvent.count({
      where: {
        companyId,
        metric: 'order_created',
        occurredAt: { gte: startOfMonth },
      },
    });

    if (currentMonthOrders >= ordersPerMonth) {
      throw new PlanLimitExceededException(
        `Monthly order limit of ${ordersPerMonth} reached for this company (${currentMonthOrders} orders used). Please upgrade your plan.`,
      );
    }
  }

  /**
   * Records an append-only usage event.
   * D-15 Invariant: Cancelled orders do NOT credit back usage (the attempt consumed capacity).
   */
  async recordUsageEvent(
    companyId: string,
    branchId: string | null,
    metric: string,
    amount = 1,
  ): Promise<void> {
    await this.prisma.usageEvent.create({
      data: {
        companyId,
        branchId,
        metric,
        amount,
        occurredAt: new Date(),
      },
    });
  }

  /**
   * Returns company usage self-view for Company Admin
   */
  async getCompanyUsage(
    callerCtx: InteractiveAuthContext,
    companyId: string,
  ): Promise<CompanyUsageViewDto> {
    if (callerCtx.role !== Role.SUPER_ADMIN && callerCtx.companyId !== companyId) {
      throw new NotFoundException('Company not found');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
      include: { plan: true },
    });

    const limits = (subscription?.plan.limits as Record<string, any>) || {};
    const ordersLimit = Number(limits['ordersPerMonth'] || 500);
    const tokensLimit = Number(limits['tokensPerDay'] || 50000);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const currentOrdersMonth = await this.prisma.usageEvent.count({
      where: {
        companyId,
        metric: 'order_created',
        occurredAt: { gte: startOfMonth },
      },
    });

    const tokenEvents = await this.prisma.usageEvent.aggregate({
      where: {
        companyId,
        metric: 'ai_tokens',
        occurredAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const currentTokensToday = Number(tokenEvents._sum.amount || 0);
    const percentOrdersUsed = Math.min(100, Math.round((currentOrdersMonth / ordersLimit) * 100));

    return {
      companyId,
      currentOrdersMonth,
      ordersLimit,
      percentOrdersUsed,
      currentTokensToday,
      tokensLimit,
      planCode: subscription?.plan.code || 'BASIC_STARTER',
      isOverLimit: currentOrdersMonth >= ordersLimit,
    };
  }
}
