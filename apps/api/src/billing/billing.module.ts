import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { SubscriptionService } from './subscription.service';
import { UsageLimitService } from './usage-limit.service';
import { PrismaService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [SubscriptionService, UsageLimitService, PrismaService],
  exports: [SubscriptionService, UsageLimitService],
})
export class BillingModule {}
