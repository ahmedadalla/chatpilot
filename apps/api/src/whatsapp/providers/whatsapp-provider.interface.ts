import {
  InboundMessageEvent,
  SendReceipt,
  PairingHandleResponse,
  WhatsAppConnectionStatus,
} from '@chatpilot/contracts';

export interface MessageContent {
  text?: string;
  mediaUrl?: string;
  interactiveButtons?: Array<{ id: string; title: string }>;
}

export interface StatusEvent {
  connectionId: string;
  status: WhatsAppConnectionStatus;
  reason?: string;
  qrDataUri?: string;
  pairingCode?: string;
}

export interface WhatsAppProvider {
  initConnection(connId: string): Promise<PairingHandleResponse>;
  onStatus(callback: (event: StatusEvent) => void): void;
  sendMessage(connId: string, toPhone: string, content: MessageContent): Promise<SendReceipt>;
}
