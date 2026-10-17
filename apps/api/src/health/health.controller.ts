import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '@chatpilot/database';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('healthz')
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Startup RLS self-test (ARCHITECTURE.md §11, IMPLEMENTATION_PLAN.md Phase 1):
   * Runs as chatpilot_app with no GUC set on companies table.
   * MUST return 0 rows. If it returns > 0, an improper role / BYPASSRLS leak occurred,
   * causing /readyz to return 503.
   */
  @Get('readyz')
  async readiness(@Res() res: Response) {
    try {
      // 1. RLS self-test with no GUC set
      const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM companies;
      `;
      const rowCount = Number(result[0]?.count ?? 0n);

      if (rowCount > 0) {
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          status: 'error',
          reason: 'RLS_SELF_TEST_FAILED_DATA_LEAK',
          message: 'Security breach: Non-zero rows returned without tenant GUC context',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(HttpStatus.OK).json({
        status: 'ready',
        database: 'connected',
        rlsSelfTest: 'passed',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error during readiness probe';
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'disconnected',
        error: message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
