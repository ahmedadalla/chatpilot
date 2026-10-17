import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';

@Controller('analytics')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('branch/:branchId/operational')
  @RequireCapabilities('analytics:operational:read')
  async getBranchOperationalMetrics(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
  ) {
    return this.analyticsService.getBranchOperationalMetrics(user, branchId);
  }

  @Get('branch/:branchId/financial')
  @RequireCapabilities('analytics:financial:read')
  async getBranchFinancialMetrics(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
  ) {
    return this.analyticsService.getBranchFinancialMetrics(user, branchId);
  }

  @Get('company/:companyId')
  @RequireCapabilities('analytics:company')
  async getCompanyMetrics(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('companyId') companyId: string,
  ) {
    return this.analyticsService.getCompanyMetrics(user, companyId);
  }

  @Get('platform')
  @RequireCapabilities('analytics:platform')
  async getPlatformMetrics(@CurrentUser() user: InteractiveAuthContext) {
    return this.analyticsService.getPlatformMetrics(user);
  }
}
