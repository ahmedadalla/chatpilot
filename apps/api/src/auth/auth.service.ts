import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { PasswordService } from './password.service';
import { SessionService, IssuedSessionTokens } from './session.service';
import { TotpService } from './totp.service';
import { Role, CompanyStatus, ROLE_CAPABILITIES, MeResponseDto } from '@chatpilot/contracts';

export interface AuthenticateCredentialsParams {
  email: string;
  password: string;
  totpCode?: string;
  recoveryCode?: string;
}

export interface AuthenticateResult {
  tokens: IssuedSessionTokens;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    companyId: string | null;
    branchId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * Primary login flow with timing-safe uniform 401 on missing account/bad password (AUTHORIZATION_MODEL.md §3.4)
   */
  async login(params: AuthenticateCredentialsParams): Promise<AuthenticateResult> {
    const { email, password, totpCode, recoveryCode } = params;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 1. Locate user lite via SECURITY DEFINER preauth lookup (bypasses RLS safely)
    const userRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        password_hash: string;
        role: string;
        company_id: string | null;
        branch_id: string | null;
        is_active: boolean;
        permissions_version: number;
      }>
    >`SELECT * FROM lookup_user_by_email(${normalizedEmail})`;
    const userLite = userRows[0];

    if (!userLite) {
      // Execute dummy password verification to eliminate timing side channels
      await this.passwordService.dummyVerify();
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Load full user + company/branch details + password verify + session creation
    //    All inside a single preauth-scope transaction so INSERT into auth_sessions
    //    (which has owner_only_policy) does not hit RLS.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT app_set_scope('preauth', NULL, NULL, ${userLite.id}::uuid)`;

      const user = await tx.user.findUnique({
        where: { id: userLite.id },
        include: { company: true, branch: true },
      });

      if (!user) {
        // Must stay inside transaction — but cannot throw to abort clean session.
        // Fallback: run dummy verify outside then throw (scope already lost).
        // This path is only reached if user record vanished between lookups.
        return { user: null } as any;
      }

      // Constant-time password verification (runs inside scope, harmless)
      const passwordValid = await this.passwordService.verify(user.passwordHash, password);
      if (!passwordValid) {
        return { user, passwordValid: false } as any;
      }

      // User account active check
      if (!user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date())) {
        return { user, active: false } as any;
      }

      // Company status active check
      if (user.role !== Role.SUPER_ADMIN && user.companyId) {
        if (!user.company || user.company.status !== CompanyStatus.ACTIVE) {
          return { user, companyActive: false } as any;
        }
        if (user.branchId && (!user.branch || !user.branch.isActive)) {
          return { user, branchActive: false } as any;
        }
      }

      // Super Admin TOTP MFA Gate (D-19)
      let mfaPassed = true;
      if (user.role === Role.SUPER_ADMIN && user.totpSecret) {
        mfaPassed = false;
        if (totpCode) {
          mfaPassed = this.totpService.verifyToken(user.totpSecret, totpCode);
        }
        if (!mfaPassed && recoveryCode && Array.isArray(user.totpRecoveryCodes)) {
          const storedHashedCodes = user.totpRecoveryCodes as string[];
          const burnResult = this.totpService.verifyAndBurnRecoveryCode(
            recoveryCode,
            storedHashedCodes,
          );
          if (burnResult.isValid) {
            mfaPassed = true;
            // Update recovery codes within the same preauth scope
            await tx.user.update({
              where: { id: user.id },
              data: { totpRecoveryCodes: burnResult.remainingHashedCodes },
            });
          }
        }
      }

      if (!mfaPassed) {
        // Create session anyway (token already issued) but flag frontend for MFA step
        const tokens = await this.sessionService.createSession(user.id, user.permissionsVersion, tx);
        return { tokens, mfaRequired: true, user } as any;
      }

      // Establish authenticated session & issue tokens (same scope)
      const tokens = await this.sessionService.createSession(user.id, user.permissionsVersion, tx);

      return { tokens, user } as any;
    });

    // Handle results from transaction
    if (result.user === null) {
      await this.passwordService.dummyVerify();
      throw new UnauthorizedException('Invalid email or password');
    }
    if (result.passwordValid === false) {
      await this.passwordService.dummyVerify();
      throw new UnauthorizedException('Invalid email or password');
    }
    if (result.active === false) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if (result.companyActive === false) {
      throw new UnauthorizedException('Company account is suspended');
    }
    if (result.branchActive === false) {
      throw new UnauthorizedException('Assigned branch is deactivated');
    }
    if (result.mfaRequired) {
      return {
        ...result,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          companyId: result.user.companyId,
          branchId: result.user.branchId,
        },
      } as AuthenticateResult & { mfaRequired: boolean };
    }

    return {
      tokens: result.tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        companyId: result.user.companyId,
        branchId: result.user.branchId,
      },
    };
  }

  /**
   * Retrieves server-verified identity, role, scope, status and capabilities
   */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT app_set_scope('preauth', NULL, NULL, ${userId}::uuid)`;
      return tx.user.findUnique({
        where: { id: userId },
        include: {
          company: true,
          branch: true,
        },
      });
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or inactive');
    }

    const capabilities = ROLE_CAPABILITIES[user.role] ?? new Set();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
            status: user.company.status,
          }
        : null,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name,
            code: user.branch.code,
            isActive: user.branch.isActive,
          }
        : null,
      capabilities: Array.from(capabilities) as string[],
      permissionsVersion: user.permissionsVersion,
    };
  }
}
