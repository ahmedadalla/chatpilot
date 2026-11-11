import { Role } from './enums';

export interface LoginDto {
  email: string;
  password: string;
  totpCode?: string;
  recoveryCode?: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  branchId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserResponse;
  mfaRequired?: boolean;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetCompleteDto {
  token: string;
  newPassword: string;
}

export interface InviteStaffDto {
  email: string;
  role: Role;
  branchId?: string;
}

export interface AcceptInvitationDto {
  token: string;
  password: string;
  name?: string;
}

export interface TotpEnrollResponse {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

export interface TotpVerifyDto {
  code: string;
}

export interface MeCompanySummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface MeBranchSummary {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface MeResponseDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  branchId: string | null;
  company?: MeCompanySummary | null;
  branch?: MeBranchSummary | null;
  capabilities: string[];
  permissionsVersion: number;
}
