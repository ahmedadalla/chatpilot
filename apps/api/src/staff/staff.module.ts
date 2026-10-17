import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@chatpilot/database';

@Module({
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffService, PrismaService],
  exports: [StaffService],
})
export class StaffModule {}
