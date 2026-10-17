import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { SetBranchAvailabilityDto, Role } from '@chatpilot/contracts';

@Injectable()
export class BranchAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sets branch availability override and optional price override (D-1).
   * Authorized for COMPANY_ADMIN (any branch in company) or BRANCH_MANAGER (assigned branch).
   */
  async setAvailability(
    callerCtx: InteractiveAuthContext,
    branchId: string,
    dto: SetBranchAvailabilityDto,
  ) {
    // 1. Scope validation
    if (callerCtx.role === Role.BRANCH_MANAGER && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    // 2. Verify branch belongs to caller's company
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // 3. Verify menu item belongs to caller's company
    const menuItem = await this.prisma.menuItem.findFirst({
      where: {
        id: dto.menuItemId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found in your company');
    }

    if (dto.priceOverride !== undefined && dto.priceOverride < 0) {
      throw new BadRequestException('Price override cannot be negative');
    }

    // 4. Upsert branch availability record
    return this.prisma.menuItemAvailability.upsert({
      where: {
        menuItemId_branchId: {
          menuItemId: dto.menuItemId,
          branchId,
        },
      },
      create: {
        branchId,
        menuItemId: dto.menuItemId,
        isAvailable: dto.isAvailable,
        priceOverride: dto.priceOverride !== undefined ? dto.priceOverride : null,
      },
      update: {
        isAvailable: dto.isAvailable,
        ...(dto.priceOverride !== undefined && { priceOverride: dto.priceOverride }),
      },
    });
  }

  /**
   * Lists all availability overrides for a given branch
   */
  async listBranchAvailability(callerCtx: InteractiveAuthContext, branchId: string) {
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

    return this.prisma.menuItemAvailability.findMany({
      where: { branchId },
      include: {
        menuItem: true,
      },
    });
  }
}
