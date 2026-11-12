import { Injectable, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { InteractiveAuthContext } from '@chatpilot/database';
import { Role } from '@chatpilot/contracts';

@Injectable()
export class ScopeGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authContext = request.authContext as InteractiveAuthContext | undefined;

    if (!authContext) {
      return true; // Let authentication guard handle unauthenticated requests
    }

    // Super Admin has platform scope
    if (authContext.role === Role.SUPER_ADMIN) {
      return true;
    }

    const { companyId, branchId } = request.params;

    // Block cross-tenant access with 403 Forbidden to avoid resource enumeration
    if (companyId && companyId !== authContext.companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Check branch scope for branch roles
    if (branchId && authContext.branchId && branchId !== authContext.branchId) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
