import { Injectable } from '@nestjs/common';
import {
  WhatsAppProvider,
  MessageContent,
  StatusEvent,
} from './whatsapp-provider.interface';
import {
  SendReceipt,
  PairingHandleResponse,
  WhatsAppConnectionStatus,
} from '@chatpilot/contracts';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

@Injectable()
export class MetaCloudApiAdapter implements WhatsAppProvider {
  private statusCallback?: (event: StatusEvent) => void;

  async initConnection(connId: string): Promise<PairingHandleResponse> {
    return {
      connectionId: connId,
      status: WhatsAppConnectionStatus.CONNECTED,
    };
  }

  onStatus(callback: (event: StatusEvent) => void): void {
    this.statusCallback = callback;
  }

  async sendMessage(
    connId: string,
    toPhone: string,
    content: MessageContent,
  ): Promise<SendReceipt> {
    const providerWamid = `wamid.HBgL${randomUUID()}`;
    return {
      messageId: randomUUID(),
      status: 'ACCEPTED',
      providerWamid,
      timestamp: new Date(),
    };
  }

  /**
   * Verifies Meta X-Hub-Signature-256 header using timing-safe comparison
   */
  static verifySignature(rawPayload: Buffer, signatureHeader: string, appSecret: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedHash = signatureHeader.slice(7).trim();
    const computedHmac = createHmac('sha256', appSecret).update(rawPayload).digest('hex');

    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const computedBuf = Buffer.from(computedHmac, 'utf8');

    if (expectedBuf.length !== computedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, computedBuf);
  }
}
