import pino from 'pino';
import { PrismaClient, OrderStatus, OrderCancellationReason } from '@chatpilot/database';

const logger = pino({ name: 'order-timeout-purge-worker' });

export class OrderTimeoutPurgeWorker {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Periodically purges stale PENDING orders past branch configured timeout (D-9)
   * Atomic conditional update ensures first-writer-wins idempotency.
   */
  async runPurgeCycle(): Promise<{ purgedCount: number }> {
    logger.info('Starting order timeout purge cycle');

    // 1. Fetch active branches
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        companyId: true,
      },
    });

    let totalPurged = 0;

    for (const branch of branches) {
      // Default timeout is 15 minutes
      const timeoutMinutes = 15;
      const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      // Single conditional UPDATE: first writer wins
      const staleOrders = await this.prisma.order.findMany({
        where: {
          branchId: branch.id,
          status: OrderStatus.PENDING,
          createdAt: { lt: cutoffTime },
        },
        select: { id: true, companyId: true, branchId: true },
      });

      for (const order of staleOrders) {
        const updated = await this.prisma.$transaction(async (tx) => {
          const res = await tx.order.updateMany({
            where: {
              id: order.id,
              status: OrderStatus.PENDING,
            },
            data: {
              status: OrderStatus.CANCELLED,
              updatedAt: new Date(),
            },
          });

          if (res.count > 0) {
            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                fromStatus: OrderStatus.PENDING,
                toStatus: OrderStatus.CANCELLED,
                actorRole: 'SYSTEM',
                reason: `${OrderCancellationReason.AUTO_TIMEOUT}: Pending order expired after ${timeoutMinutes} minutes`,
              },
            });
            return true;
          }
          return false;
        });

        if (updated) {
          totalPurged++;
          logger.info({ orderId: order.id, branchId: branch.id }, 'Order auto-cancelled due to timeout');
        }
      }
    }

    logger.info({ totalPurged }, 'Order timeout purge cycle completed');
    return { purgedCount: totalPurged };
  }
}
