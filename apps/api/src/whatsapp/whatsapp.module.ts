import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { HybridRoutingService } from './routing/hybrid-routing.service';
import { WhatsAppOutService } from './queue/whatsapp-out.service';
import { MetaCloudApiAdapter } from './providers/meta-cloud-api.adapter';
import { WhatsAppCoexistenceAdapter } from './providers/coexistence.adapter';
import { BaileysQrAdapter } from './providers/baileys-qr.adapter';
import { PrismaService } from '@chatpilot/database';
import { SecurityModule } from '../security/security.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SecurityModule, AuthModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    HybridRoutingService,
    WhatsAppOutService,
    MetaCloudApiAdapter,
    WhatsAppCoexistenceAdapter,
    BaileysQrAdapter,
    PrismaService,
  ],
  exports: [WhatsAppService, HybridRoutingService, WhatsAppOutService],
})
export class WhatsAppModule {}
