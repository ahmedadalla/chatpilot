import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { SecretsService } from '../security/secrets.service';
import { HybridRoutingService } from './routing/hybrid-routing.service';
import { MetaCloudApiAdapter } from './providers/meta-cloud-api.adapter';
import { WhatsAppCoexistenceAdapter } from './providers/coexistence.adapter';
import { BaileysQrAdapter } from './providers/baileys-qr.adapter';
import {
  WhatsAppProviderType,
  WhatsAppConnectionStatus,
  SetupWhatsAppConnectionDto,
  PairingHandleResponse,
  InboundMessageEvent,
  normalizePhoneNumber,
} from '@chatpilot/contracts';
import pino from 'pino';

const logger = pino({ name: 'whatsapp-service' });

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretsService: SecretsService,
    private readonly hybridRoutingService: HybridRoutingService,
    private readonly cloudApiAdapter: MetaCloudApiAdapter,
    private readonly coexistenceAdapter: WhatsAppCoexistenceAdapter,
    private readonly baileysQrAdapter: BaileysQrAdapter,
  ) {}

  /**
   * Sets up a new WhatsApp connection across any of the 3 customer-selectable options (Q-REQ-4)
   */
  async setupConnection(
    callerCtx: InteractiveAuthContext,
    dto: SetupWhatsAppConnectionDto,
  ): Promise<PairingHandleResponse> {
    // 1. Mandatory customer risk acknowledgement for unofficial QR pairing
    if (dto.provider === WhatsAppProviderType.REGULAR_QR_PAIRING && !dto.riskAcknowledged) {
      throw new BadRequestException(
        'Explicit customer risk acknowledgement is required before initiating regular WhatsApp QR pairing',
      );
    }

    // 2. Normalize phone number if supplied
    let normalizedPhone: string | null = null;
    if (dto.phoneNumber) {
      const parsed = normalizePhoneNumber(dto.phoneNumber);
      normalizedPhone = parsed.e164;
    }

    // 3. Encrypt initial credentials placeholder
    const encryptedCredentials = this.secretsService.encrypt(
      JSON.stringify({ initializedAt: new Date().toISOString() }),
    );

    // 4. Create connection record
    const connection = await this.prisma.whatsAppConnection.create({
      data: {
        companyId: callerCtx.companyId!,
        branchId: dto.branchId || null,
        provider: dto.provider,
        businessConnectionId: dto.businessConnectionId.trim(),
        phoneNumber: normalizedPhone,
        status: WhatsAppConnectionStatus.DISCONNECTED,
        riskAcknowledgedAt: dto.riskAcknowledged ? new Date() : null,
        encryptedCredentials,
      },
    });

    // 5. Select provider adapter
    let adapter;
    switch (dto.provider) {
      case WhatsAppProviderType.CLOUD_API:
        adapter = this.cloudApiAdapter;
        break;
      case WhatsAppProviderType.COEXISTENCE:
        adapter = this.coexistenceAdapter;
        break;
      case WhatsAppProviderType.REGULAR_QR_PAIRING:
        adapter = this.baileysQrAdapter;
        break;
      default:
        throw new BadRequestException('Unsupported WhatsApp provider');
    }

    return adapter.initConnection(connection.id);
  }

  /**
   * Ingests verified inbound message with 5-minute freshness check, dedup, and hybrid routing (ARCHITECTURE.md §6.3)
   */
  async handleInboundMessage(
    connectionId: string,
    event: InboundMessageEvent,
  ): Promise<{ status: string; actionTaken: string }> {
    // 1. 5-minute event freshness window check (ARCHITECTURE.md §6.3)
    const eventTime = new Date(event.timestamp).getTime();
    const ageMs = Date.now() - eventTime;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    if (ageMs > FIVE_MINUTES_MS) {
      await this.prisma.auditLog.create({
        data: {
          action: 'STALE_WEBHOOK',
          entityType: 'WhatsAppWebhook',
          entityId: event.providerMessageId,
          details: { ageMs, sender: event.senderPhone },
        },
      });
      return { status: 'acknowledged', actionTaken: 'DROPPED_STALE_EVENT' };
    }

    // 2. Deduplication check via WhatsAppEventDedup (Two-phase idempotency)
    try {
      await this.prisma.whatsAppEventDedup.create({
        data: {
          provider: event.provider,
          providerMessageId: event.providerMessageId,
        },
      });
    } catch (err: unknown) {
      // P2002 Unique constraint violation: event already received!
      logger.info({ messageId: event.providerMessageId }, 'Duplicate WhatsApp event dropped');
      return { status: 'acknowledged', actionTaken: 'DROPPED_DUPLICATE_EVENT' };
    }

    // 3. Resolve Connection & Tenant binding
    const connection = await this.prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      // Quarantine unknown connection
      await this.prisma.auditLog.create({
        data: {
          action: 'UNKNOWN_WHATSAPP_CONNECTION',
          entityType: 'WhatsAppConnection',
          entityId: connectionId,
          details: { sender: event.senderPhone },
        },
      });
      return { status: 'acknowledged', actionTaken: 'QUARANTINED_UNKNOWN_CONNECTION' };
    }

    // 4. Normalize sender phone
    const normalizedSender = normalizePhoneNumber(event.senderPhone).e164;

    // 5. Upsert Customer and Conversation
    const customer = await this.prisma.customer.upsert({
      where: {
        companyId_phone: {
          companyId: connection.companyId,
          phone: normalizedSender,
        },
      },
      create: {
        companyId: connection.companyId,
        phone: normalizedSender,
      },
      update: {},
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        companyId: connection.companyId,
        customerId: customer.id,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId: connection.companyId,
          customerId: customer.id,
          branchId: connection.branchId || null,
        },
      });
    }

    // 6. Execute Hybrid Branch-Routing Resolution (Q-REQ-5)
    const routingResult = await this.hybridRoutingService.resolveBranchRoute(
      connection.companyId,
      connection.branchId,
      conversation.branchId,
    );

    if (routingResult.requiresCustomerSelection) {
      // Persist inbound message and prompt customer to select branch
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'IN',
          content: event.text || '[Media Attachment]',
          externalMessageId: event.providerMessageId,
        },
      });

      return {
        status: 'acknowledged',
        actionTaken: 'BRANCH_SELECTION_REQUIRED',
      };
    }

    // Update conversation with resolved active branch
    if (routingResult.branchId && conversation.branchId !== routingResult.branchId) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { branchId: routingResult.branchId },
      });
    }

    // 7. Persist Inbound Message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'IN',
        content: event.text || '[Media Attachment]',
        externalMessageId: event.providerMessageId,
      },
    });

    return {
      status: 'acknowledged',
      actionTaken: 'DISPATCHED_TO_AI_ORDERING',
    };
  }
}
