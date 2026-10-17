import pino from 'pino';
import { PrismaClient, OrderStatus } from '@chatpilot/database';

const logger = pino({ name: 'analytics-aggregate-worker' });

export class AnalyticsAggregateWorker {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Aggregates daily stats for active companies, branches, and platform (D-11, D-20, ARCHITECTURE.md §10.1).
   * Runs hourly and generates idempotent daily rollup snapshots.
   */
  async runDailyAggregation(): Promise<void> {
    logger.info('Starting daily analytics aggregation cycle');

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const day = new Date(todayStr);

    const companies = await this.prisma.company.findMany({
      where: { status: 'ACTIVE' },
      include: {
        settings: true,
        branches: { where: { isActive: true } },
      },
    });

    const platformGmvByCurrency: Record<string, number> = {};

    for (const company of companies) {
      const currency = company.settings?.defaultCurrency || 'EGP';
      let companyTotalOrders = 0;
      let companyDelivered = 0;
      let companyCancelled = 0;
      let companyFailed = 0;
      let companyGmv = 0;

      for (const branch of company.branches) {
        // Aggregate branch metrics for the day
        const orders = await this.prisma.order.findMany({
          where: {
            branchId: branch.id,
            sequenceDay: day,
          },
        });

        const totalOrders = orders.length;
        const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;
        const cancelledOrders = orders.filter((o) => o.status === OrderStatus.CANCELLED).length;
        const failedDeliveryOrders = orders.filter((o) => o.status === OrderStatus.FAILED_DELIVERY).length;

        const deliveredOrdersList = orders.filter((o) => o.status === OrderStatus.DELIVERED);
        const gmvTotal = deliveredOrdersList.reduce((sum, o) => sum + Number(o.total), 0);
        const gmvSubtotal = deliveredOrdersList.reduce((sum, o) => sum + Number(o.subtotal), 0);
        const gmvDelivery = deliveredOrdersList.reduce((sum, o) => sum + Number(o.deliveryFee), 0);
        const avgOrderValue = deliveredOrders > 0 ? gmvTotal / deliveredOrders : 0;

        // Upsert BranchDailyStats
        await this.prisma.branchDailyStats.upsert({
          where: {
            branchId_day: {
              branchId: branch.id,
              day,
            },
          },
          create: {
            companyId: company.id,
            branchId: branch.id,
            day,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            failedDeliveryOrders,
            gmvSubtotal,
            gmvDelivery,
            gmvTotal,
            avgOrderValue,
            currency,
          },
          update: {
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            failedDeliveryOrders,
            gmvSubtotal,
            gmvDelivery,
            gmvTotal,
            avgOrderValue,
            currency,
          },
        });

        companyTotalOrders += totalOrders;
        companyDelivered += deliveredOrders;
        companyCancelled += cancelledOrders;
        companyFailed += failedDeliveryOrders;
        companyGmv += gmvTotal;
      }

      // Upsert CompanyDailyStats
      await this.prisma.companyDailyStats.upsert({
        where: {
          companyId_day: {
            companyId: company.id,
            day,
          },
        },
        create: {
          companyId: company.id,
          day,
          totalOrders: companyTotalOrders,
          deliveredOrders: companyDelivered,
          cancelledOrders: companyCancelled,
          failedDeliveryOrders: companyFailed,
          gmvSubtotal: companyGmv,
          gmvDelivery: 0,
          gmvTotal: companyGmv,
          avgOrderValue: companyDelivered > 0 ? companyGmv / companyDelivered : 0,
          currency,
        },
        update: {
          totalOrders: companyTotalOrders,
          deliveredOrders: companyDelivered,
          cancelledOrders: companyCancelled,
          failedDeliveryOrders: companyFailed,
          gmvTotal: companyGmv,
          avgOrderValue: companyDelivered > 0 ? companyGmv / companyDelivered : 0,
          currency,
        },
      });

      platformGmvByCurrency[currency] = (platformGmvByCurrency[currency] || 0) + companyGmv;
    }

    // Upsert PlatformDailyStats (currency-specific breakdown, D-11, D-20)
    const [totalCompanies, activeCompanies, totalBranches, totalOrders] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: 'ACTIVE' } }),
      this.prisma.branch.count({ where: { isActive: true } }),
      this.prisma.order.count(),
    ]);

    await this.prisma.platformDailyStats.upsert({
      where: { day },
      create: {
        day,
        totalCompanies,
        activeCompanies,
        totalBranches,
        totalOrders,
        gmvByCurrency: platformGmvByCurrency as any,
        saasMrrActiveCompanies: activeCompanies * 2500,
      },
      update: {
        totalCompanies,
        activeCompanies,
        totalBranches,
        totalOrders,
        gmvByCurrency: platformGmvByCurrency as any,
        saasMrrActiveCompanies: activeCompanies * 2500,
      },
    });

    logger.info('Daily analytics aggregation completed');
  }
}
