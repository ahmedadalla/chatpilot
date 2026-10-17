import { Injectable } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';

@Injectable()
export class PermissionVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Centralized chokepoint: increments User.permissionsVersion atomically.
   * In-flight JWTs with the old version will be immediately rejected by JwtAuthGuard (AUTHORIZATION_MODEL.md §3.2).
   */
  async bump(userId: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        permissionsVersion: { increment: 1 },
      },
      select: { permissionsVersion: true },
    });

    return updated.permissionsVersion;
  }
}
