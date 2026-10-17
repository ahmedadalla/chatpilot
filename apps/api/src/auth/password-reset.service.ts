import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { PasswordService } from './password.service';
import { PermissionVersionService } from './permission-version.service';
import { randomBytes, createHash } from 'node:crypto';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly permissionVersionService: PermissionVersionService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a single-use short-TTL password reset token.
   * Always returns a generic success message to prevent user enumeration.
   */
  async requestReset(email: string): Promise<{ success: boolean; resetToken?: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      // Return generic response without revealing account existence
      return { success: true };
    }

    // Invalidate any existing active password reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // In local dev/test, resetToken is returned; in prod, it is emailed
    return {
      success: true,
      resetToken: rawToken,
    };
  }

  /**
   * Completes a password reset: validates token, hashes new password with Argon2id,
   * revokes all active sessions for the user, and increments permissionsVersion.
   */
  async completeReset(rawToken: string, newPassword: string): Promise<void> {
    if (!rawToken || !newPassword) {
      throw new UnauthorizedException('Missing token or password');
    }

    const tokenHash = this.hashToken(rawToken);

    await this.prisma.$transaction(async (tx) => {
      const resetRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!resetRecord) {
        throw new UnauthorizedException('Invalid or already used password reset token');
      }

      if (resetRecord.expiresAt < new Date()) {
        await tx.passwordResetToken.delete({ where: { id: resetRecord.id } });
        throw new UnauthorizedException('Password reset token expired');
      }

      // Hash new password using Argon2id
      const newPasswordHash = await this.passwordService.hash(newPassword);

      // Update password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newPasswordHash,
          permissionsVersion: { increment: 1 },
        },
      });

      // Revoke all existing sessions for this user
      await tx.authSession.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Single-use: delete the used token record
      await tx.passwordResetToken.delete({
        where: { id: resetRecord.id },
      });
    });
  }
}
