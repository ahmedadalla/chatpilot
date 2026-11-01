import { Role, Capability } from '@chatpilot/contracts';

export type TenantScopeType = 'company' | 'branch' | 'service' | 'preauth' | 'user' | 'platform';

export interface BaseTenantContext {
  scope: TenantScopeType;
  companyId?: string | null;
  branchId?: string | null;
  userId?: string | null;
}

export interface InteractiveAuthContext extends BaseTenantContext {
  userId: string;
  sessionId?: string;
  role: Role;
  userCompanyId: string | null;
  userBranchId: string | null;
  permissionsVersion: number;
  capabilities: ReadonlySet<Capability>;
}

export interface ServiceContext extends BaseTenantContext {
  scope: 'service';
  serviceName: string;
  companyId: string;
  branchId: string;
}

export interface PreauthContext extends BaseTenantContext {
  scope: 'preauth';
}

export interface UserAuthContext extends BaseTenantContext {
  scope: 'user';
  userId: string;
}

export interface TenantQueryContext extends BaseTenantContext {
  scope: 'company' | 'branch';
  companyId: string;
  branchId?: string | null;
}

export interface PlatformSupportContext extends BaseTenantContext {
  scope: 'platform';
  auditReason: string;
  superAdminUserId: string;
}

export type ScopedContext =
  | InteractiveAuthContext
  | TenantQueryContext
  | ServiceContext
  | PreauthContext
  | UserAuthContext
  | PlatformSupportContext;
