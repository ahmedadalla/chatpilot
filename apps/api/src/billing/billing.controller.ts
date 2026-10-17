import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UsageLimitService } from './usage-limit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreatePlanDto,
  AssignSubscriptionDto,
} from '@chatpilot/contracts';

@Controller('billing')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageLimitService: UsageLimitService,
  ) {}

  @Get('plans')
  async listPlans() {
    return this.subscriptionService.listPlans();
  }

  @Post('plans')
  @RequireCapabilities('company:create') // Super Admin privilege
  async createPlan(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreatePlanDto,
  ) {
    return this.subscriptionService.createPlan(user, dto);
  }

  @Post('subscriptions/assign')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('company:subscribe:assign')
  async assignSubscription(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.subscriptionService.assignSubscription(user, dto);
  }

  @Get('usage/:companyId')
  @RequireCapabilities('company:usage:read')
  async getCompanyUsage(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('companyId') companyId: string,
  ) {
    return this.usageLimitService.getCompanyUsage(user, companyId);
  }
}
