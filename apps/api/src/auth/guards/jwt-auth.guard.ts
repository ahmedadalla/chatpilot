import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InteractiveAuthContext, TenantScopeService } from '@chatpilot/database';
import { TokenService } from '../token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLE_CAPABILITIES, CompanyStatus, Role } from '@chatpilot/contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Bypass public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    // 2. Verify JWT signature & expiration (contains only { sub, sid, jti, ver })
    const payload = this.tokenService.verifyAccessToken(token);

    // 3. Load owner-only auth records inside the user's RLS scope.
    const identity = await this.tenantScopeService.runInScope(
      { scope: 'user', userId: payload.sub },
      async (tx) => {
        const [session, user] = await Promise.all([
          tx.authSession.findUnique({ where: { id: payload.sid } }),
          tx.user.findUnique({ where: { id: payload.sub } }),
        ]);
        return { session, user };
      },
    );

    const { session, user } = identity;
    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has been revoked');
    }

    if (!user || !user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date())) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // 4. Verify company & branch active status in the user's tenant scope.
    const tenant =
      user.role !== Role.SUPER_ADMIN && user.companyId
        ? await this.tenantScopeService.runInScope(
            {
              scope: user.branchId ? 'branch' : 'company',
              companyId: user.companyId,
              branchId: user.branchId,
            },
            async (tx) => {
              const [company, branch] = await Promise.all([
                tx.company.findUnique({ where: { id: user.companyId! } }),
                user.branchId
                  ? tx.branch.findUnique({ where: { id: user.branchId } })
                  : Promise.resolve(null),
              ]);
              return { company, branch };
            },
          )
        : null;

    if (user.role !== Role.SUPER_ADMIN && user.companyId) {
      if (!tenant?.company || tenant.company.status !== CompanyStatus.ACTIVE) {
        throw new UnauthorizedException('Company account is suspended');
      }

      if (user.branchId && (!tenant.branch || !tenant.branch.isActive)) {
        throw new UnauthorizedException('Assigned branch is deactivated');
      }
    }

    // 6. Stale-token guard (AUTHORIZATION_MODEL.md §3.2)
    // JWT ver must match current User.permissionsVersion
    if (payload.ver !== user.permissionsVersion) {
      throw new UnauthorizedException('Permissions version is stale; re-authentication required');
    }

    // 7. Resolve capabilities from verified role
    const capabilities = ROLE_CAPABILITIES[user.role] ?? new Set();

    // 8. Build trusted AuthContext
    const authContext: InteractiveAuthContext = {
      scope: user.role === Role.SUPER_ADMIN ? 'platform' : user.branchId ? 'branch' : 'company',
      userId: user.id,
      sessionId: payload.sid,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId,
      userCompanyId: user.companyId,
      userBranchId: user.branchId,
      permissionsVersion: user.permissionsVersion,
      capabilities,
    };

    request.authContext = authContext;
    return true;
  }
}
