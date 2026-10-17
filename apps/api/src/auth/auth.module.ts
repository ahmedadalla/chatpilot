import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
import { PasswordResetService } from './password-reset.service';
import { InvitationService } from './invitation.service';
import { PermissionVersionService } from './permission-version.service';
import { PrismaService } from '@chatpilot/database';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CapabilitiesGuard } from './guards/capabilities.guard';
import { ScopeGuard } from './guards/scope.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    TotpService,
    PasswordResetService,
    InvitationService,
    PermissionVersionService,
    PrismaService,
    JwtAuthGuard,
    CapabilitiesGuard,
    ScopeGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    TotpService,
    PasswordResetService,
    InvitationService,
    PermissionVersionService,
    JwtAuthGuard,
    CapabilitiesGuard,
    ScopeGuard,
  ],
})
export class AuthModule {}
