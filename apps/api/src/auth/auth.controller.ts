import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { PasswordResetService } from './password-reset.service';
import { InvitationService } from './invitation.service';
import { TotpService } from './totp.service';
import { PrismaService } from '@chatpilot/database';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  LoginDto,
  PasswordResetRequestDto,
  PasswordResetCompleteDto,
  AcceptInvitationDto,
  TotpVerifyDto,
  Role,
} from '@chatpilot/contracts';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
    private readonly invitationService: InvitationService,
    private readonly totpService: TotpService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // Set refresh token in HttpOnly SameSite=Lax Secure cookie
    res.cookie('cp_rft', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const rawRefreshToken = req.cookies?.['cp_rft'] || bodyToken;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const result = await this.sessionService.rotateRefreshToken(rawRefreshToken);

    res.cookie('cp_rft', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: InteractiveAuthContext) {
    return this.authService.getMe(user.userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: InteractiveAuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Revoke database session and refresh tokens
    if (user.sessionId) {
      await this.sessionService.revokeSession(user.sessionId, user.userId);
    }

    // 2. Clear refresh cookie across both auth and root paths
    res.clearCookie('cp_rft', { path: '/' });

    return { success: true };
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Post('password-reset/complete')
  @HttpCode(HttpStatus.OK)
  async completePasswordReset(@Body() dto: PasswordResetCompleteDto) {
    await this.passwordResetService.completeReset(dto.token, dto.newPassword);
    return { success: true };
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invitationService.acceptInvitation(dto.token, dto.password, dto.name);

    res.cookie('cp_rft', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser() user: InteractiveAuthContext) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userRecord) {
      throw new UnauthorizedException('User not found');
    }

    const mfaSetup = this.totpService.generateSecret(userRecord.email);

    // Save secret and hashed recovery codes
    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        totpSecret: mfaSetup.secret,
        totpRecoveryCodes: mfaSetup.hashedRecoveryCodes,
      },
    });

    return {
      secret: mfaSetup.secret,
      otpauthUri: mfaSetup.otpauthUri,
      recoveryCodes: mfaSetup.recoveryCodes,
    };
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@CurrentUser() user: InteractiveAuthContext, @Body() dto: TotpVerifyDto) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userRecord || !userRecord.totpSecret) {
      throw new BadRequestException('MFA has not been initiated for this account');
    }

    const isValid = this.totpService.verifyToken(userRecord.totpSecret, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP verification code');
    }

    return { success: true };
  }
}
