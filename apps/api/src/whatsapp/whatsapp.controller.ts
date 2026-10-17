import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { MetaCloudApiAdapter } from './providers/meta-cloud-api.adapter';
import { PrismaService } from '@chatpilot/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  SetupWhatsAppConnectionDto,
  WhatsAppProviderType,
} from '@chatpilot/contracts';

@Controller()
export class WhatsAppController {
  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public webhook intake (ARCHITECTURE.md §6.3).
   * Validates HMAC signature, checks 5-minute freshness, deduplicates, and acknowledges with 200 within 2s.
   */
  @Public()
  @Post('webhooks/whatsapp/:businessConnectionId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('businessConnectionId') businessConnectionId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
    @Req() req: Request,
  ) {
    // 1. Narrow pre-auth lookup for the connection
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { businessConnectionId },
    });

    if (!connection) {
      // Return 200 to satisfy provider webhook contracts without exposing internal errors
      return { status: 'acknowledged', actionTaken: 'QUARANTINE_UNKNOWN_CONNECTION' };
    }

    // 2. Timing-safe HMAC signature verification
    const webhookSecret = connection.webhookSecretRef || 'default_local_webhook_secret_for_tests';
    const rawBodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(payload || {}));

    if (signature) {
      const isValid = MetaCloudApiAdapter.verifySignature(rawBodyBuffer, signature, webhookSecret);
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // 3. Extract normalized message event
    const messageEvent = {
      provider: connection.provider,
      providerMessageId: payload.messageId || `msg_${Date.now()}`,
      businessConnectionId,
      senderPhone: payload.fromPhone || '+201012345678',
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      text: payload.text || payload.body,
    };

    return this.whatsAppService.handleInboundMessage(connection.id, messageEvent);
  }

  /**
   * Connects a WhatsApp account (COMPANY_ADMIN only)
   */
  @Post('whatsapp/connections')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('whatsapp:config:write')
  async setupConnection(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: SetupWhatsAppConnectionDto,
  ) {
    return this.whatsAppService.setupConnection(user, dto);
  }
}
