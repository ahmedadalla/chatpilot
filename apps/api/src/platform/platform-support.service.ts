import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  PrismaService,
  TenantScopeService,
  InteractiveAuthContext,
} from '@chatpilot/database';
import { Role } from '@chatpilot/contracts';

@Injectable()
export class PlatformSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  /**
   * Lists all companies on the platform for Super Admin overview
   */
  async listCompanies(callerCtx: InteractiveAuthContext) {
    if (callerCtx.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can access platform company overview');
    }

    const companies = await this.prisma.company.findMany({
      include: {
        settings: true,
        _count: {
          select: {
            branches: true,
            users: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companies.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: c.status,
      settings: c.settings,
      branchCount: c._count.branches,
      userCount: c._count.users,
      orderCount: c._count.orders,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Audited cross-tenant company inspection (D-5, AUTHORIZATION_MODEL.md §5.4):
   * Runs inside TenantScopeService.runInPlatformSupportScope and writes an AuditLog
   * entry with the mandatory audit reason.
   */
  async getCompanyDetails(
    callerCtx: InteractiveAuthContext,
    companyId: string,
    auditReason: string,
  ) {
    if (callerCtx.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can access platform support inspection');
    }

    if (!auditReason || auditReason.trim() === '') {
      throw new BadRequestException('A valid audit reason is required for platform support inspection');
    }

    return this.tenantScopeService.runInPlatformSupportScope(
      {
        scope: 'platform',
        auditReason: auditReason.trim(),
        superAdminUserId: callerCtx.userId,
      },
      async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          include: {
            settings: true,
            branches: true,
            _count: {
              select: {
                users: true,
                orders: true,
                whatsAppConnections: true,
              },
            },
          },
        });

        if (!company) {
          throw new NotFoundException('Company not found');
        }

        return company;
      },
    );
  }
}
