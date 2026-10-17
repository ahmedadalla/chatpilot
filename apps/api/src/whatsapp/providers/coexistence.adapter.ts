import { Injectable } from '@nestjs/common';
import { MetaCloudApiAdapter } from './meta-cloud-api.adapter';
import {
  PairingHandleResponse,
  WhatsAppConnectionStatus,
} from '@chatpilot/contracts';

@Injectable()
export class WhatsAppCoexistenceAdapter extends MetaCloudApiAdapter {
  override async initConnection(connId: string): Promise<PairingHandleResponse> {
    return {
      connectionId: connId,
      status: WhatsAppConnectionStatus.CONNECTED,
    };
  }
}
