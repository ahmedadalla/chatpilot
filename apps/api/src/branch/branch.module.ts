import { Module } from '@nestjs/common';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { PrismaService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BranchController],
  providers: [BranchService, PrismaService],
  exports: [BranchService],
})
export class BranchModule {}
