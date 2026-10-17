import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { BranchAvailabilityService } from './branch-availability.service';
import { AvailabilityResolutionService } from './availability-resolution.service';
import { PrismaService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MenuController],
  providers: [
    MenuService,
    BranchAvailabilityService,
    AvailabilityResolutionService,
    PrismaService,
  ],
  exports: [
    MenuService,
    BranchAvailabilityService,
    AvailabilityResolutionService,
  ],
})
export class MenuModule {}
