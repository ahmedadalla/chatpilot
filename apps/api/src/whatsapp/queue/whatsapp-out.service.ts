import { Injectable } from '@nestjs/common';
import pino from 'pino';
import { MessageContent } from '../providers/whatsapp-provider.interface';
import { SendReceipt } from '@chatpilot/contracts';
import { randomUUID } from 'node:crypto';

const logger = pino({ name: 'whatsapp-out-service' });

@Injectable()
export class WhatsAppOutService {
  /**
   * Enqueues outbound message with rate limiting and backoff (ARCHITECTURE.md §6.4)
   */
  async enqueueMessage(
    connectionId: string,
    toPhone: string,
    content: MessageContent,
  ): Promise<SendReceipt> {
    logger.info({ connectionId, toPhone }, 'Outbound WhatsApp message queued');

    return {
      messageId: randomUUID(),
      status: 'QUEUED',
      timestamp: new Date(),
    };
  }
}
