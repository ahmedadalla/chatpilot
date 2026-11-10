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

    // 1. Locate user record
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!user) {
      // Execute dummy password verification to eliminate timing side channels
      await this.passwordService.dummyVerify();
      throw new UnauthorizedException('Invalid email or password');
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
    if (user.role === Role.SUPER_ADMIN && user.totpSecret) {
      let mfaPassed = false;

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

  /**
   * Retrieves server-verified identity, role, scope, status and capabilities
   */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        branch: true,
      },
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
