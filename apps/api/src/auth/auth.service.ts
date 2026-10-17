import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
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
    if (user.role === Role.SUPER_ADMIN) {
      let mfaPassed = false;

      if (user.totpSecret && totpCode) {
        mfaPassed = this.totpService.verifyToken(user.totpSecret, totpCode);
      }

      if (!mfaPassed && recoveryCode && Array.isArray(user.totpRecoveryCodes)) {
        const storedHashedCodes = user.totpRecoveryCodes as string[];
        const burnResult = this.totpService.verifyAndBurnRecoveryCode(recoveryCode, storedHashedCodes);

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
        throw new ForbiddenException('Super Admin login requires valid TOTP MFA code or recovery code');
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
