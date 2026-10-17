import pino from 'pino';
import { PrismaClient, CompanyStatus } from '@chatpilot/database';

const logger = pino({ name: 'subscription-check-worker' });

export class SubscriptionCheckWorker {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Hourly check: enforces plan limits and suspends non-compliant companies (ARCHITECTURE.md §10.2).
   */
  async runComplianceCheck(): Promise<{ suspendedCompanies: string[] }> {
    logger.info('Starting subscription plan compliance check cycle');

    const suspendedCompanies: string[] = [];
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        company: { include: { users: { select: { id: true } } } },
        plan: true,
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const sub of subscriptions) {
      const limits = (sub.plan.limits as Record<string, any>) || {};
      const ordersLimit = Number(limits['ordersPerMonth'] || 0);

      if (ordersLimit <= 0) {
        continue; // Unlimited
      }

      // Check current month orders
      const currentOrders = await this.prisma.usageEvent.count({
        where: {
          companyId: sub.companyId,
          metric: 'order_created',
          occurredAt: { gte: startOfMonth },
        },
      });

      // If hard cap exceeded by 10% grace margin, suspend company
      const hardCap = ordersLimit * 1.1;
      if (currentOrders > hardCap && sub.company.status === CompanyStatus.ACTIVE) {
        logger.warn(
          { companyId: sub.companyId, currentOrders, ordersLimit },
          'Company exceeded plan order limit and grace period; triggering suspension',
        );

        const userIds = sub.company.users.map((u) => u.id);

        await this.prisma.$transaction(async (tx) => {
          // 1. Suspend company
          await tx.company.update({
            where: { id: sub.companyId },
            data: { status: CompanyStatus.SUSPENDED },
          });

          // 2. Cascading session revocation
          if (userIds.length > 0) {
            await tx.authSession.updateMany({
              where: { userId: { in: userIds }, revokedAt: null },
              data: { revokedAt: new Date() },
            });

            await tx.user.updateMany({
              where: { id: { in: userIds } },
              data: { permissionsVersion: { increment: 1 } },
            });
          }

          // 3. AuditLog
          await tx.auditLog.create({
            data: {
              companyId: sub.companyId,
              action: 'COMPANY_AUTO_SUSPENDED_OVER_QUOTA',
              entityType: 'Company',
              entityId: sub.companyId,
              details: {
                currentOrders,
                ordersLimit,
                planCode: sub.plan.code,
              },
            },
          });
        });

        suspendedCompanies.push(sub.companyId);
      }
    }

    logger.info({ suspendedCount: suspendedCompanies.length }, 'Subscription compliance check cycle complete');
    return { suspendedCompanies };
  }
}
