import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateBranchDto,
  UpdateBranchSettingsDto,
  UpdateTimezoneDto,
  Role,
} from '@chatpilot/contracts';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new branch under caller's company (COMPANY_ADMIN only)
   */
  async createBranch(callerCtx: InteractiveAuthContext, dto: CreateBranchDto) {
    if (!callerCtx.companyId) {
      throw new ForbiddenException('Super Admin cannot directly create branches');
    }

    const code = dto.code.trim().toUpperCase();

    // Check code uniqueness per company
    const existing = await this.prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId: callerCtx.companyId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Branch with code "${code}" already exists in this company`);
    }

    // Default timezone from company settings if omitted
    let timezone = dto.timezone?.trim();
    if (!timezone) {
      const companySettings = await this.prisma.companySettings.findUnique({
        where: { companyId: callerCtx.companyId },
      });
      timezone = companySettings?.defaultTimezone || 'Africa/Cairo';
    }

    return this.prisma.branch.create({
      data: {
        companyId: callerCtx.companyId,
        code,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        timezone,
        deliveryFee: dto.deliveryFee !== undefined ? dto.deliveryFee : 0,
        minOrder: dto.minOrder !== undefined ? dto.minOrder : 0,
        operatingHours: (dto.operatingHours as any) || null,
      },
    });
  }

  /**
   * Deactivates a branch (COMPANY_ADMIN only)
   */
  async deactivateBranch(callerCtx: InteractiveAuthContext, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    });
  }

  /**
   * Retrieves a single branch with non-leaking 404 for out-of-scope requests
   */
  async getBranch(callerCtx: InteractiveAuthContext, branchId: string) {
    // If caller is branch role, strictly restricted to own assigned branch
    if (callerCtx.branchId && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  /**
   * Lists branches: all branches for Company Admin, assigned branch for branch staff
   */
  async listBranches(callerCtx: InteractiveAuthContext) {
    if (callerCtx.role === Role.COMPANY_ADMIN) {
      return this.prisma.branch.findMany({
        where: { companyId: callerCtx.companyId! },
        orderBy: { code: 'asc' },
      });
    }

    // Branch-scoped role
    if (callerCtx.branchId) {
      return this.prisma.branch.findMany({
        where: {
          id: callerCtx.branchId,
          companyId: callerCtx.companyId!,
        },
      });
    }

    return [];
  }

  /**
   * Updates operational settings (name, address, operatingHours, deliveryFee, minOrder)
   * COMPANY_ADMIN or BRANCH_MANAGER of assigned branch
   */
  async updateBranchSettings(
    callerCtx: InteractiveAuthContext,
    branchId: string,
    dto: UpdateBranchSettingsDto,
  ) {
    // Branch manager can update only their own assigned branch
    if (callerCtx.role === Role.BRANCH_MANAGER && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address ? dto.address.trim() : null }),
        ...(dto.deliveryFee !== undefined && { deliveryFee: dto.deliveryFee }),
        ...(dto.minOrder !== undefined && { minOrder: dto.minOrder }),
        ...(dto.operatingHours !== undefined && { operatingHours: dto.operatingHours as any }),
      },
    });
  }

  /**
   * Audited Company Admin timezone correction (D-18):
   * Strictly COMPANY_ADMIN only. Mandates audit reason.
   * Preserves historical order timestamps and sequenceDay dates on past orders.
   */
  async updateTimezone(
    callerCtx: InteractiveAuthContext,
    branchId: string,
    dto: UpdateTimezoneDto,
  ): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can correct a branch timezone');
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('A valid reason is required for timezone correction');
    }

    if (!dto.timezone || dto.timezone.trim() === '') {
      throw new BadRequestException('Timezone is required');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const oldTimezone = branch.timezone;
    const newTimezone = dto.timezone.trim();

    await this.prisma.$transaction(async (tx) => {
      // 1. Update branch timezone
      await tx.branch.update({
        where: { id: branchId },
        data: { timezone: newTimezone },
      });

      // 2. Mandatory AuditLog entry
      await tx.auditLog.create({
        data: {
          companyId: callerCtx.companyId!,
          actorUserId: callerCtx.userId,
          action: 'BRANCH_TIMEZONE_UPDATED',
          entityType: 'Branch',
          entityId: branchId,
          details: {
            oldTimezone,
            newTimezone,
            reason: dto.reason.trim(),
          },
        },
      });
    });
  }
}
