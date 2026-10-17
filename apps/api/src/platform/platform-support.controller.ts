import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PlatformSupportService } from './platform-support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';

@Controller('platform')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class PlatformSupportController {
  constructor(private readonly platformSupportService: PlatformSupportService) {}

  @Get('companies')
  @RequireCapabilities('company:read')
  async listCompanies(@CurrentUser() user: InteractiveAuthContext) {
    return this.platformSupportService.listCompanies(user);
  }

  @Get('companies/:id')
  @RequireCapabilities('company:read')
  async getCompanyDetails(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') companyId: string,
    @Query('reason') auditReason: string,
  ) {
    if (!auditReason) {
      throw new BadRequestException('Query parameter "reason" is required for platform support inspection');
    }
    return this.platformSupportService.getCompanyDetails(user, companyId, auditReason);
  }
}
