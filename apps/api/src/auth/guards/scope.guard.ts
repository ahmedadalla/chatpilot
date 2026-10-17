import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { InteractiveAuthContext } from '@chatpilot/database';
import { Role } from '@chatpilot/contracts';

@Injectable()
export class ScopeGuard implements CanActivate {
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

    // Check company scope: Cross-tenant attempts return 404 Not Found (AUTHORIZATION_MODEL.md §4)
    if (companyId && companyId !== authContext.companyId) {
      throw new NotFoundException('Resource not found');
    }

    // Check branch scope for branch roles
    if (branchId && authContext.branchId && branchId !== authContext.branchId) {
      throw new NotFoundException('Resource not found');
    }

    return true;
  }
}
