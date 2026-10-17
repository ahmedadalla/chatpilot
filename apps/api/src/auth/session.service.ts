import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { TokenService } from './token.service';
import { randomBytes, createHash } from 'node:crypto';
import { CompanyStatus, Role } from '@chatpilot/contracts';

export interface IssuedSessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn: number;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Hashes a token using SHA-256 for secure constant-time storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a cryptographically secure 256-bit random refresh token string
   */
  private generateRawRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Creates a new AuthSession and initial rotating RefreshToken for an authenticated user.
   */
  async createSession(userId: string, permissionsVersion: number): Promise<IssuedSessionTokens> {
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const sessionTtlDays = 7;
    const sessionExpiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.authSession.create({
      data: {
        userId,
        expiresAt: sessionExpiresAt,
        refreshTokens: {
          create: {
            userId,
            tokenHash,
            expiresAt: refreshExpiresAt,
          },
        },
      },
    });

    const accessToken = this.tokenService.issueAccessToken(userId, session.id, permissionsVersion);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      expiresIn: 900,
    };
  }

  /**
   * Compare-and-Swap (CAS) Refresh Token Rotation with Reuse Detection (AUTHORIZATION_MODEL.md §3.2)
   */
  async rotateRefreshToken(rawRefreshToken: string): Promise<IssuedSessionTokens> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Missing or invalid refresh token');
    }

    const incomingHash = this.hashToken(rawRefreshToken);

    return this.prisma.$transaction(async (tx) => {
      // 1. Locate the refresh token record
      const tokenRecord = await tx.refreshToken.findUnique({
        where: { tokenHash: incomingHash },
        include: {
          session: true,
          user: {
            include: {
              company: true,
              branch: true,
            },
          },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 2. Reuse Detection / Theft Signal:
      // If the token was already revoked, someone is replaying an old rotated token!
      if (tokenRecord.revokedAt !== null || tokenRecord.session.revokedAt !== null) {
        // Revoke the entire session immediately and write an audit security event
        await tx.authSession.update({
          where: { id: tokenRecord.sessionId },
          data: { revokedAt: new Date() },
        });

        await tx.refreshToken.updateMany({
          where: { sessionId: tokenRecord.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            companyId: tokenRecord.user.companyId,
            actorUserId: tokenRecord.userId,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
            entityType: 'AuthSession',
            entityId: tokenRecord.sessionId,
            details: {
              reason: 'Replay of an already rotated refresh token',
              tokenId: tokenRecord.id,
            },
          },
        });

        throw new UnauthorizedException('Security alert: Refresh token reuse detected; session terminated');
      }

      // 3. Expiration Check
      if (tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // 4. Freshness Re-Verification: user, company, and branch active states
      const user = tokenRecord.user;

      if (!user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date())) {
        throw new UnauthorizedException('User account is deactivated');
      }

      if (user.role !== Role.SUPER_ADMIN && user.companyId) {
        if (!user.company || user.company.status !== CompanyStatus.ACTIVE) {
          throw new UnauthorizedException('Company account is suspended or not active');
        }

        if (user.branchId && (!user.branch || !user.branch.isActive)) {
          throw new UnauthorizedException('Assigned branch is deactivated');
        }
      }

      // 5. Atomic Rotation: Mark current token revoked, generate and persist new token
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      const newRawRefreshToken = this.generateRawRefreshToken();
      const newTokenHash = this.hashToken(newRawRefreshToken);
      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: tokenRecord.sessionId,
          tokenHash: newTokenHash,
          expiresAt: newRefreshExpiresAt,
        },
      });

      // Issue new access JWT
      const newAccessToken = this.tokenService.issueAccessToken(
        user.id,
        tokenRecord.sessionId,
        user.permissionsVersion,
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
        sessionId: tokenRecord.sessionId,
        expiresIn: 900,
      };
    });
  }

  /**
   * Revokes a session and all its associated refresh tokens on logout
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.refreshToken.updateMany({
        where: { sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
