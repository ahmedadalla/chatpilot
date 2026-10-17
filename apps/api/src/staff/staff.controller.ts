import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import { InviteStaffDto, Role } from '@chatpilot/contracts';

@Controller('staff')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('invite')
  @RequireCapabilities('staff:invite')
  async invite(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.invite(user, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('staff:deactivate')
  async deactivate(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') targetUserId: string,
  ) {
    await this.staffService.deactivate(user, targetUserId);
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('staff:invite') // company-level role management
  async changeRole(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') targetUserId: string,
    @Body('role') newRole: Role,
  ) {
    await this.staffService.changeRole(user, targetUserId, newRole);
  }
}
