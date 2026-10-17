import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { randomBytes, createHash } from 'node:crypto';

@Injectable()
export class PendingOrderService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
  }

  /**
   * Generates a 7-character random confirmation token (e.g. "CONFIRM-A1B2C3D")
   */
  generateConfirmToken(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 unambiguous charset
    let token = '';
    const bytes = randomBytes(7);
    for (let i = 0; i < 7; i++) {
      token += chars[bytes[i]! % chars.length];
    }
    return token;
  }

  /**
   * Creates a pending order with 10-minute expiration and hashed confirmation token (ARCHITECTURE.md §7.4)
   */
  async createPendingOrder(
    companyId: string,
    branchId: string,
    conversationId: string,
    lines: Array<{ itemId: string; name: string; price: number; quantity: number; lineTotal: number }>,
    pricesSnapshot: { subtotal: number; deliveryFee: number; total: number; currency: string },
  ) {
    const confirmToken = this.generateConfirmToken();
    const confirmTokenHash = this.hashToken(confirmToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    const pendingOrder = await this.prisma.pendingOrder.create({
      data: {
        companyId,
        branchId,
        conversationId,
        lines: lines as any,
        pricesSnapshot: pricesSnapshot as any,
        confirmTokenHash,
        status: 'OPEN',
        expiresAt,
      },
    });

    return {
      pendingOrderId: pendingOrder.id,
      confirmToken,
      expiresAt,
    };
  }

  /**
   * Consumes a pending order atomically.
   * Fails closed if expired (422), already consumed (409), or token mismatch (422).
   */
  async consumePendingOrder(pendingOrderId: string, rawToken: string) {
    const targetHash = this.hashToken(rawToken);

    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.pendingOrder.findUnique({
        where: { id: pendingOrderId },
      });

      if (!pending) {
        throw new NotFoundException('Pending cart not found');
      }

      // Check if already consumed (double confirmation attempt)
      if (pending.status === 'CONSUMED') {
        throw new ConflictException({
          code: 'PENDING_ORDER_ALREADY_CONSUMED',
          message: 'This order proposal has already been confirmed and placed',
        });
      }

      // Check if expired
      if (pending.expiresAt < new Date() || pending.status === 'EXPIRED') {
        await tx.pendingOrder.update({
          where: { id: pendingOrderId },
          data: { status: 'EXPIRED' },
        });
        throw new UnprocessableEntityException({
          code: 'PENDING_ORDER_EXPIRED',
          message: 'The 10-minute confirmation window has expired. Please request a fresh cart.',
        });
      }

      // Check confirmation token match
      if (pending.confirmTokenHash !== targetHash) {
        throw new UnprocessableEntityException({
          code: 'INVALID_CONFIRMATION_TOKEN',
          message: 'Confirmation code does not match the open order proposal',
        });
      }

      // Atomically transition status to CONSUMED
      return tx.pendingOrder.update({
        where: { id: pendingOrderId },
        data: { status: 'CONSUMED' },
      });
    });
  }

  /**
   * Drops a pending order
   */
  async cancelPendingOrder(pendingOrderId: string): Promise<void> {
    await this.prisma.pendingOrder.updateMany({
      where: { id: pendingOrderId, status: 'OPEN' },
      data: { status: 'EXPIRED' },
    });
  }
}
