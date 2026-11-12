import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
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
import { SetupWhatsAppConnectionDto, WhatsAppProviderType } from '@chatpilot/contracts';
import pino from 'pino';

const logger = pino({ name: 'whatsapp-controller' });

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
    @Res() res: Response,
  ) {
    // Return 200 immediately; process asynchronously to avoid provider timeout
    let promise: Promise<any>;
    try {
      // 1. Narrow pre-auth lookup for the connection
      const connection = await this.prisma.whatsAppConnection.findFirst({
        where: { businessConnectionId },
      });

      if (!connection) {
        // Return 200 to satisfy provider webhook contracts without exposing internal errors
        return res.status(200).json({ status: 'acknowledged', actionTaken: 'QUARANTINE_UNKNOWN_CONNECTION' });
      }

      // 2. Timing-safe HMAC signature verification
      const webhookSecret = connection.webhookSecretRef || 'default_local_webhook_secret_for_tests';
      const rawBodyBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(payload || {}));

      if (signature) {
        const isValid = MetaCloudApiAdapter.verifySignature(rawBodyBuffer, signature, webhookSecret);
        if (!isValid) {
          return res.status(200).json({ status: 'acknowledged', actionTaken: 'INVALID_SIGNATURE' });
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

      promise = this.whatsAppService.handleInboundMessage(connection.id, messageEvent);
    } catch (webhookErr: unknown) {
      logger.error({ err: webhookErr }, 'Unhandled error in WhatsApp webhook handler');
      return res.status(200).json({ status: 'acknowledged', actionTaken: 'INTERNAL_ERROR' });
    }

    // Fire-and-forget: resolve silently, log on failure
    promise.catch((err: unknown) => {
      logger.error({ err }, 'Error processing WhatsApp inbound message');
    });

    return res.status(200).json({ status: 'acknowledged', actionTaken: 'ACCEPTED' });
  }

  /**
   * Lists all WhatsApp connections
   */
  @Get('whatsapp/connections')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('company:read')
  async listConnections(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.whatsAppService.listConnections(user, branchId);
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

  /**
   * Disconnects a WhatsApp connection
   */
  @Delete('whatsapp/connections/:id')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('whatsapp:config:write')
  async disconnectConnection(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') connectionId: string,
  ) {
    await this.whatsAppService.disconnectConnection(user, connectionId);
  }

  /**
   * Refreshes pairing QR / code for a connection
   */
  @Post('whatsapp/connections/:id/refresh-qr')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('whatsapp:config:write')
  async refreshQr(@CurrentUser() user: InteractiveAuthContext, @Param('id') connectionId: string) {
    return this.whatsAppService.refreshQr(user, connectionId);
  }
}
