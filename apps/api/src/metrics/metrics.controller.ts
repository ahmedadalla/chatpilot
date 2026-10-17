import { Controller, Get, Header } from '@nestjs/common';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    return [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '# HELP chatpilot_active_connections Number of active connections.',
      '# TYPE chatpilot_active_connections gauge',
      'chatpilot_active_connections 0',
    ].join('\n');
  }
}
