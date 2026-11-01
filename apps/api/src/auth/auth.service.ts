import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService, TenantScopeService } from '@chatpilot/database';
import { PasswordService } from './password.service';
import { SessionService, IssuedSessionTokens } from './session.service';
import { TotpService } from './totp.service';
import { Role, CompanyStatus } from '@chatpilot/contracts';

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
    private readonly tenantScopeService: TenantScopeService,
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

    // 1. Locate user record
    const user = await this.tenantScopeService.runInScope({ scope: 'preauth' }, async (tx) => {
      const rows = await tx.$queryRaw<PreauthUserRow[]>`
          SELECT *
          FROM lookup_user_by_email(${normalizedEmail})
        `;
      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        email: row.email,
        name: row.name,
        passwordHash: row.password_hash,
        role: row.role as Role,
        companyId: row.company_id,
        branchId: row.branch_id,
        isActive: row.is_active,
        deactivatedAt: row.deactivated_at,
        permissionsVersion: row.permissions_version,
        totpSecret: row.totp_secret,
        totpRecoveryCodes: row.totp_recovery_codes,
        company: row.company_status ? { status: row.company_status as CompanyStatus } : null,
        branch: row.branch_is_active === null ? null : { isActive: row.branch_is_active },
      };
    });

    if (!user) {
      // Execute dummy password verification to eliminate timing side channels
      await this.passwordService.dummyVerify();
      throw new UnauthorizedException('Invalid email or password');
    }

    interface PreauthUserRow {
      id: string;
      email: string;
      name: string;
      password_hash: string;
      role: string;
      company_id: string | null;
      branch_id: string | null;
      is_active: boolean;
      deactivated_at: Date | null;
      permissions_version: number;
      totp_secret: string | null;
      totp_recovery_codes: unknown;
      company_status: string | null;
      branch_is_active: boolean | null;
    }

    // 2. Constant-time password verification
    const passwordValid = await this.passwordService.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. User account active check
    if (!user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date())) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // 4. Company status active check
    if (user.role !== Role.SUPER_ADMIN && user.companyId) {
      if (!user.company || user.company.status !== CompanyStatus.ACTIVE) {
        throw new UnauthorizedException('Company account is suspended');
      }

      if (user.branchId && (!user.branch || !user.branch.isActive)) {
        throw new UnauthorizedException('Assigned branch is deactivated');
      }
    }

    // 5. Super Admin TOTP MFA Gate (D-19)
    if (user.role === Role.SUPER_ADMIN) {
      let mfaPassed = false;

      if (user.totpSecret && totpCode) {
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
          // Update remaining recovery codes
          await this.prisma.user.update({
            where: { id: user.id },
            data: { totpRecoveryCodes: burnResult.remainingHashedCodes },
          });
        }
      }

      if (!mfaPassed) {
        throw new ForbiddenException(
          'Super Admin login requires valid TOTP MFA code or recovery code',
        );
      }
    }

    // 6. Establish authenticated session & issue tokens
    const tokens = await this.sessionService.createSession(user.id, user.permissionsVersion);

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        branchId: user.branchId,
      },
    };
  }
}
