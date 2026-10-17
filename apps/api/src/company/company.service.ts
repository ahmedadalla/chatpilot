import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import {
  CompanyStatus,
  Role,
  InvitationStatus,
  CreateCompanyDto,
  UpdateCompanySettingsDto,
} from '@chatpilot/contracts';
import { randomBytes, createHash } from 'node:crypto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Atomic Company Creation (SUPER_ADMIN only):
   * Creates Company (status INITIATED) + CompanySettings + first admin Invitation + AuditLog.
   * Atomic rollback: if any part fails, nothing is committed.
   */
  async createCompany(
    dto: CreateCompanyDto,
    superAdminUserId: string,
  ): Promise<{ companyId: string; slug: string; adminInvitationToken: string }> {
    const slug = dto.slug.toLowerCase().trim();
    const adminEmail = dto.adminEmail.toLowerCase().trim();

    // Check slug uniqueness
    const existing = await this.prisma.company.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Company with slug "${slug}" already exists`);
    }

    const rawInvitationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawInvitationToken);
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: {
          name: dto.name.trim(),
          slug,
          status: CompanyStatus.INITIATED,
        },
      });

      // 2. Create company settings with Egypt defaults (Q-REQ-6) or overrides
      await tx.companySettings.create({
        data: {
          companyId: company.id,
          countryCode: dto.countryCode || 'EG',
          defaultCurrency: dto.defaultCurrency || 'EGP',
          defaultTimezone: dto.defaultTimezone || 'Africa/Cairo',
          defaultLocale: dto.defaultLocale || 'ar-EG',
          defaultCallingCode: dto.defaultCallingCode || '+20',
        },
      });

      // 3. Create initial admin invitation
      await tx.invitation.create({
        data: {
          companyId: company.id,
          email: adminEmail,
          role: Role.COMPANY_ADMIN,
          tokenHash,
          status: InvitationStatus.PENDING,
          expiresAt: invitationExpiresAt,
        },
      });

      // 4. AuditLog
      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorUserId: superAdminUserId,
          action: 'COMPANY_CREATED',
          entityType: 'Company',
          entityId: company.id,
          details: {
            slug: company.slug,
            adminEmail,
          },
        },
      });

      return {
        companyId: company.id,
        slug: company.slug,
        adminInvitationToken: rawInvitationToken,
      };
    });
  }

  /**
   * Suspends a company and cascades session revocation across all its users.
   */
  async suspendCompany(
    companyId: string,
    reason: string,
    actorUserId: string,
  ): Promise<void> {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Suspension reason is required');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { users: { select: { id: true } } },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const userIds = company.users.map((u) => u.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Update company status
      await tx.company.update({
        where: { id: companyId },
        data: { status: CompanyStatus.SUSPENDED },
      });

      // 2. Cascading session revocation for all users of this company
      if (userIds.length > 0) {
        await tx.authSession.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.refreshToken.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        // Bump permissions version for immediate JWT staleness
        await tx.user.updateMany({
          where: { id: { in: userIds } },
          data: { permissionsVersion: { increment: 1 } },
        });
      }

      // 3. Record AuditLog
      await tx.auditLog.create({
        data: {
          companyId,
          actorUserId,
          action: 'COMPANY_SUSPENDED',
          entityType: 'Company',
          entityId: companyId,
          details: { reason },
        },
      });
    });
  }

  /**
   * Activates a suspended company.
   */
  async activateCompany(companyId: string, actorUserId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { status: CompanyStatus.ACTIVE },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorUserId,
          action: 'COMPANY_ACTIVATED',
          entityType: 'Company',
          entityId: companyId,
        },
      });
    });
  }

  /**
   * Retrieves company and settings. Enforces non-leaking 404 for cross-tenant attempts.
   */
  async getCompany(callerCtx: InteractiveAuthContext, companyId: string) {
    if (callerCtx.role !== Role.SUPER_ADMIN && callerCtx.companyId !== companyId) {
      throw new NotFoundException('Company not found');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /**
   * Updates company settings (COMPANY_ADMIN only for own company).
   */
  async updateCompanySettings(
    callerCtx: InteractiveAuthContext,
    companyId: string,
    dto: UpdateCompanySettingsDto,
  ) {
    if (callerCtx.companyId !== companyId) {
      throw new NotFoundException('Company not found');
    }

    return this.prisma.companySettings.update({
      where: { companyId },
      data: {
        ...(dto.countryCode && { countryCode: dto.countryCode }),
        ...(dto.defaultCurrency && { defaultCurrency: dto.defaultCurrency }),
        ...(dto.defaultTimezone && { defaultTimezone: dto.defaultTimezone }),
        ...(dto.defaultLocale && { defaultLocale: dto.defaultLocale }),
        ...(dto.defaultCallingCode && { defaultCallingCode: dto.defaultCallingCode }),
      },
    });
  }
}
