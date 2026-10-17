import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { CompanyModule } from './company/company.module';
import { BranchModule } from './branch/branch.module';
import { PlatformModule } from './platform/platform.module';
import { MenuModule } from './menu/menu.module';
import { FileModule } from './file/file.module';
import { SocketModule } from './socket/socket.module';
import { OrderModule } from './order/order.module';
import { SecurityModule } from './security/security.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { KbModule } from './kb/kb.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    SecurityModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    StaffModule,
    CompanyModule,
    BranchModule,
    PlatformModule,
    MenuModule,
    FileModule,
    SocketModule,
    OrderModule,
    WhatsAppModule,
    AiModule,
    KbModule,
    BillingModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
