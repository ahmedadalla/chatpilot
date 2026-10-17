import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateCompanyDto,
  UpdateCompanySettingsDto,
  SuspendCompanyDto,
} from '@chatpilot/contracts';

@Controller('companies')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @RequireCapabilities('company:create')
  async createCompany(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companyService.createCompany(dto, user.userId);
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('company:suspend/activate')
  async suspendCompany(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') companyId: string,
    @Body() dto: SuspendCompanyDto,
  ) {
    await this.companyService.suspendCompany(companyId, dto.reason, user.userId);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('company:suspend/activate')
  async activateCompany(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') companyId: string,
  ) {
    await this.companyService.activateCompany(companyId, user.userId);
  }

  @Get(':id')
  @RequireCapabilities('company:read')
  async getCompany(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') companyId: string,
  ) {
    return this.companyService.getCompany(user, companyId);
  }

  @Patch(':id/settings')
  @RequireCapabilities('company:settings:write')
  async updateCompanySettings(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') companyId: string,
    @Body() dto: UpdateCompanySettingsDto,
  ) {
    return this.companyService.updateCompanySettings(user, companyId, dto);
  }
}
