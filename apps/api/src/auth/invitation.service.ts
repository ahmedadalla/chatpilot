import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { PasswordService } from './password.service';
import { SessionService, IssuedSessionTokens } from './session.service';
import { Role, CompanyStatus, InvitationStatus } from '@chatpilot/contracts';
import { randomBytes, createHash } from 'node:crypto';

export interface CreateInvitationParams {
  callerRole: Role;
  callerCompanyId: string;
  callerBranchId: string | null;
  email: string;
  role: Role;
  branchId?: string | null;
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Enforces grantor allowlists and creates an invitation record (AUTHORIZATION_MODEL.md §3.6)
   */
  async createInvitation(params: CreateInvitationParams): Promise<{ invitationId: string; rawToken: string }> {
    const { callerRole, callerCompanyId, callerBranchId, email, role, branchId } = params;
    const normalizedEmail = email.toLowerCase().trim();

    // Invariant: Non-platform users can NEVER create or invite SUPER_ADMIN
    if (role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot invite or elevate to SUPER_ADMIN role');
    }

    // Grantor allowlist enforcement:
    if (callerRole === Role.COMPANY_ADMIN) {
      // Company Admin may invite company-level or branch-level users for their own company
      const allowedRoles = new Set([
        Role.COMPANY_ADMIN,
        Role.BRANCH_MANAGER,
        Role.KITCHEN,
        Role.DELIVERY,
        Role.STAFF,
      ]);
      if (!allowedRoles.has(role)) {
        throw new ForbiddenException(`Company Admin cannot grant role ${role}`);
      }
    } else if (callerRole === Role.BRANCH_MANAGER) {
      // Branch Manager may invite only operational branch staff to their own branch
      const allowedRoles = new Set([Role.KITCHEN, Role.DELIVERY, Role.STAFF]);
      if (!allowedRoles.has(role)) {
        throw new ForbiddenException(`Branch Manager cannot grant role ${role}`);
      }
      if (!branchId || branchId !== callerBranchId) {
        throw new ForbiddenException('Branch Manager can invite staff only to their own assigned branch');
      }
    } else {
      throw new ForbiddenException('Caller role is not authorized to send invitations');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.invitation.create({
      data: {
        companyId: callerCompanyId,
        branchId: branchId ?? null,
        email: normalizedEmail,
        role,
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt,
      },
    });

    return {
      invitationId: invitation.id,
      rawToken,
    };
  }

  /**
   * Accepts an invitation: sets password, creates active user,
   * switches company from INITIATED to ACTIVE on first admin accept,
   * and establishes authenticated session.
   */
  async acceptInvitation(
    rawToken: string,
    password: string,
    name?: string,
  ): Promise<{ user: { id: string; email: string; role: Role }; tokens: IssuedSessionTokens }> {
    if (!rawToken || !password) {
      throw new UnauthorizedException('Token and password are required');
    }

    const tokenHash = this.hashToken(rawToken);

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
        include: { company: true },
      });

      if (!invitation || invitation.status !== InvitationStatus.PENDING) {
        throw new UnauthorizedException('Invalid or already used invitation');
      }

      if (invitation.expiresAt < new Date()) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.REVOKED },
        });
        throw new UnauthorizedException('Invitation has expired');
      }

      const passwordHash = await this.passwordService.hash(password);
      const userName = name?.trim() || invitation.email.split('@')[0] || 'User';

      // Create active user
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name: userName,
          passwordHash,
          role: invitation.role,
          companyId: invitation.companyId,
          branchId: invitation.branchId,
          isActive: true,
          isVerified: true,
          permissionsVersion: 1,
        },
      });

      // Mark invitation accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      // First admin company activation rule:
      // If company is in INITIATED status and first admin accepts, transition Company to ACTIVE
      if (invitation.company.status === CompanyStatus.INITIATED && invitation.role === Role.COMPANY_ADMIN) {
        await tx.company.update({
          where: { id: invitation.companyId },
          data: { status: CompanyStatus.ACTIVE },
        });
      }

      // Create authenticated session
      const tokens = await this.sessionService.createSession(user.id, user.permissionsVersion);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        tokens,
      };
    });
  }
}
