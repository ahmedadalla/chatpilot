import { WhatsAppProviderType, WhatsAppConnectionStatus } from './enums';

export interface InboundMessageEvent {
  provider: WhatsAppProviderType;
  providerMessageId: string;
  businessConnectionId: string;
  senderPhone: string;
  timestamp: Date;
  text?: string;
  mediaRef?: string;
}

export interface SendReceipt {
  messageId: string;
  status: 'QUEUED' | 'ACCEPTED' | 'FAILED';
  providerWamid?: string;
  timestamp: Date;
}

export interface HybridRoutingResult {
  branchId?: string;
  requiresCustomerSelection: boolean;
  availableBranches?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

export interface SetupWhatsAppConnectionDto {
  provider: WhatsAppProviderType;
  businessConnectionId: string;
  phoneNumber?: string;
  branchId?: string;
  riskAcknowledged?: boolean; // Required for REGULAR_QR_PAIRING
}

export interface PairingHandleResponse {
  connectionId: string;
  status: WhatsAppConnectionStatus;
  qrDataUri?: string;
  pairingCode?: string;
}
