import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { InvitationService } from '../auth/invitation.service';
import { PermissionVersionService } from '../auth/permission-version.service';
import { Role, InviteStaffDto } from '@chatpilot/contracts';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationService: InvitationService,
    private readonly permissionVersionService: PermissionVersionService,
  ) {}

  /**
   * Invites a new staff member within caller's scope and according to grantor allowlists
   */
  async invite(callerCtx: InteractiveAuthContext, dto: InviteStaffDto) {
    if (!callerCtx.companyId) {
      throw new ForbiddenException('Super Admin cannot directly invite restaurant staff');
    }

    return this.invitationService.createInvitation({
      callerRole: callerCtx.role,
      callerCompanyId: callerCtx.companyId,
      callerBranchId: callerCtx.branchId,
      email: dto.email,
      role: dto.role,
      branchId: dto.branchId,
    });
  }

  /**
   * Deactivates a staff member with last-admin constraint protection (AUTHORIZATION_MODEL.md §1)
   */
  async deactivate(callerCtx: InteractiveAuthContext, targetUserId: string): Promise<void> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.companyId !== callerCtx.companyId) {
      throw new NotFoundException('User not found');
    }

    if (callerCtx.role === Role.BRANCH_MANAGER) {
      if (targetUser.branchId !== callerCtx.branchId) {
        throw new ForbiddenException('Branch Manager cannot deactivate staff from another branch');
      }
      if (targetUser.role === Role.COMPANY_ADMIN || targetUser.role === Role.BRANCH_MANAGER) {
        throw new ForbiddenException('Branch Manager cannot deactivate admin or management roles');
      }
    }

    // Last-Admin Protection Constraint
    if (targetUser.role === Role.COMPANY_ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          companyId: callerCtx.companyId,
          role: Role.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictException({
          code: 'LAST_ADMIN_CONSTRAINT',
          message: 'Cannot deactivate the last active Company Admin of a company',
        });
      }
    }

    // Deactivate user
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    // Invalidate any in-flight tokens
    await this.permissionVersionService.bump(targetUserId);

    // Revoke all active sessions
    await this.prisma.authSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Changes a user's role with last-admin check and permission version bump
   */
  async changeRole(
    callerCtx: InteractiveAuthContext,
    targetUserId: string,
    newRole: Role,
  ): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin may change staff roles');
    }

    if (newRole === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign SUPER_ADMIN role');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.companyId !== callerCtx.companyId) {
      throw new NotFoundException('User not found');
    }

    // Last-Admin Protection: demoting the last Company Admin
    if (targetUser.role === Role.COMPANY_ADMIN && newRole !== Role.COMPANY_ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          companyId: callerCtx.companyId,
          role: Role.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictException({
          code: 'LAST_ADMIN_CONSTRAINT',
          message: 'Cannot demote the last active Company Admin of a company',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await this.permissionVersionService.bump(targetUserId);
  }
}
