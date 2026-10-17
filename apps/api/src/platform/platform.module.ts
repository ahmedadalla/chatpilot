import { Module } from '@nestjs/common';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';
import { PrismaService, TenantScopeService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlatformSupportController],
  providers: [PlatformSupportService, PrismaService, TenantScopeService],
  exports: [PlatformSupportService],
})
export class PlatformModule {}
