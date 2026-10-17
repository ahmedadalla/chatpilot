import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { TokenService } from '../token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLE_CAPABILITIES, CompanyStatus, Role } from '@chatpilot/contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
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

    // 3. Verify server-side session exists and is not revoked/expired
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has been revoked');
    }

    // 4. Load fresh user record (never trust scope from client)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!user || !user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date())) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // 5. Verify company & branch active status
    if (user.role !== Role.SUPER_ADMIN && user.companyId) {
      if (!user.company || user.company.status !== CompanyStatus.ACTIVE) {
        throw new UnauthorizedException('Company account is suspended');
      }

      if (user.branchId && (!user.branch || !user.branch.isActive)) {
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
