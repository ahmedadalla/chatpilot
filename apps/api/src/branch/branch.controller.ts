import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateBranchDto,
  UpdateBranchSettingsDto,
  UpdateTimezoneDto,
} from '@chatpilot/contracts';

@Controller('branches')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @RequireCapabilities('branch:create/deactivate')
  async createBranch(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchService.createBranch(user, dto);
  }

  @Get()
  @RequireCapabilities('company:read')
  async listBranches(@CurrentUser() user: InteractiveAuthContext) {
    return this.branchService.listBranches(user);
  }

  @Get(':id')
  @RequireCapabilities('company:read')
  async getBranch(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') branchId: string,
  ) {
    return this.branchService.getBranch(user, branchId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('branch:create/deactivate')
  async deactivateBranch(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') branchId: string,
  ) {
    await this.branchService.deactivateBranch(user, branchId);
  }

  @Patch(':id/settings')
  @RequireCapabilities('branch:settings:write')
  async updateBranchSettings(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') branchId: string,
    @Body() dto: UpdateBranchSettingsDto,
  ) {
    return this.branchService.updateBranchSettings(user, branchId, dto);
  }

  @Patch(':id/timezone')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('branch:settings:write')
  async updateTimezone(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') branchId: string,
    @Body() dto: UpdateTimezoneDto,
  ) {
    await this.branchService.updateTimezone(user, branchId, dto);
  }
}
