import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  ScopedContext,
  InteractiveAuthContext,
  PlatformSupportContext,
} from './context';
import { InvalidTenantContextException } from './exceptions';
import { Role } from '@chatpilot/contracts';

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Primary entry point for all tenant-scoped database queries (D-4).
   * Opens a transaction, sets transaction-local GUCs, runs fn(tx), and commits.
   */
  async runInScope<T>(
    ctx: ScopedContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    // 1. Invariant: Ordinary scope setter strictly rejects 'platform' scope (Gate B)
    if (ctx.scope === 'platform') {
      throw new InvalidTenantContextException(
        "Platform scope cannot be requested via ordinary runInScope. Use PlatformSupportService.",
      );
    }

    // 2. Invariant: Validate user-tenant binding consistency for interactive sessions
    if ('role' in ctx && ctx.userId) {
      const authCtx = ctx as InteractiveAuthContext;
      if (authCtx.role !== Role.SUPER_ADMIN) {
        if (!authCtx.userCompanyId || authCtx.userCompanyId !== authCtx.companyId) {
          throw new InvalidTenantContextException(
            `User company mismatch: User (${authCtx.userId}) of company (${authCtx.userCompanyId}) attempted to access company (${authCtx.companyId})`,
          );
        }
        if (
          authCtx.branchId &&
          authCtx.userBranchId &&
          authCtx.userBranchId !== authCtx.branchId
        ) {
          throw new InvalidTenantContextException(
            `User branch mismatch: User (${authCtx.userId}) assigned to branch (${authCtx.userBranchId}) attempted to access branch (${authCtx.branchId})`,
          );
        }
      }
    }

    const scope = ctx.scope;
    const companyId = ctx.companyId ?? null;
    const branchId = ctx.branchId ?? null;
    const userId = ctx.userId ?? null;

    // 3. Execute inside a transaction with transaction-local GUCs
    return this.prisma.$transaction(async (tx) => {
      // Parameterized call — strictly no string interpolation
      await tx.$executeRaw`SELECT app_set_scope(
        ${scope},
        ${companyId}::uuid,
        ${branchId}::uuid,
        ${userId}::uuid
      )`;

      return fn(tx);
    });
  }

  /**
   * Audited, isolated platform support path for SUPER_ADMIN only (D-5).
   * Records an AuditLog entry in the same transaction.
   */
  async runInPlatformSupportScope<T>(
    ctx: PlatformSupportContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!ctx.auditReason || ctx.auditReason.trim() === '') {
      throw new InvalidTenantContextException(
        'Platform support scope requires a valid audit reason',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Establish audited platform scope
      await tx.$executeRaw`SELECT app_set_platform_scope(${ctx.auditReason})`;

      // 2. Write AuditLog row within the same transaction
      await tx.auditLog.create({
        data: {
          actorUserId: ctx.superAdminUserId,
          action: 'PLATFORM_CROSS_TENANT_ACCESS',
          entityType: 'PlatformSupport',
          details: { reason: ctx.auditReason },
        },
      });

      // 3. Execute platform operation
      return fn(tx);
    });
  }
}
