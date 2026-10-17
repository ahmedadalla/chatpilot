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
import { randomBytes, randomUUID } from 'node:crypto';

@Injectable()
export class BaileysQrAdapter implements WhatsAppProvider {
  private statusCallback?: (event: StatusEvent) => void;

  async initConnection(connId: string): Promise<PairingHandleResponse> {
    // Generates simulated QR code and 8-digit pairing code for multi-device setup (D-21)
    const rawCode = randomBytes(4).toString('hex').toUpperCase();
    const pairingCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;
    const qrDataUri = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

    return {
      connectionId: connId,
      status: WhatsAppConnectionStatus.PAIRING_QR_READY,
      qrDataUri,
      pairingCode,
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
    return {
      messageId: randomUUID(),
      status: 'ACCEPTED',
      providerWamid: `baileys.${randomUUID()}`,
      timestamp: new Date(),
    };
  }
}
