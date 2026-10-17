import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import pino from 'pino';
import { PrismaService } from '@chatpilot/database';
import { TokenService } from '../auth/token.service';
import { SocketTokenService } from './socket-token.service';
import { Role, OrderStatus, OrderSocketEventPayload } from '@chatpilot/contracts';

const logger = pino({ name: 'order-events-gateway' });

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/events',
})
export class OrderEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly socketTokenService: SocketTokenService,
  ) {}

  /**
   * Handshake authentication and server-decided room assignment (ARCHITECTURE.md §9.1)
   */
  async handleConnection(client: Socket) {
    try {
      let userId: string | null = null;
      let sessionId: string | null = null;

      // 1. Check handshake headers: Bearer token or One-time handshake token
      const authHeader = client.handshake.headers['authorization'];
      const oneTimeToken = client.handshake.query['token'] as string | undefined;

      if (oneTimeToken) {
        // Option B: One-time token
        const consumed = this.socketTokenService.consumeOneTimeToken(oneTimeToken);
        userId = consumed.userId;
        sessionId = consumed.sessionId;
      } else if (authHeader && authHeader.startsWith('Bearer ')) {
        // Option A: Access JWT
        const token = authHeader.slice(7).trim();
        const payload = this.tokenService.verifyAccessToken(token);
        userId = payload.sub;
        sessionId = payload.sid;
      } else {
        client.disconnect(true);
        return;
      }

      // 2. Verify Session exists and is active
      const session = await this.prisma.authSession.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
        client.disconnect(true);
        return;
      }

      // 3. Load User identity
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { company: true, branch: true },
      });

      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      // Store identity on client data
      client.data.userId = user.id;
      client.data.role = user.role;
      client.data.companyId = user.companyId;
      client.data.branchId = user.branchId;
      client.data.permissionsVersion = user.permissionsVersion;

      // 4. Server-decided room assignments:
      if (user.role === Role.SUPER_ADMIN) {
        void client.join('platform');
      } else if (user.role === Role.COMPANY_ADMIN && user.companyId) {
        void client.join(`co:${user.companyId}`);
        // Join all branch rooms of company
        const branches = await this.prisma.branch.findMany({
          where: { companyId: user.companyId, isActive: true },
          select: { id: true },
        });
        for (const b of branches) {
          void client.join(`co:${user.companyId}:br:${b.id}`);
        }
      } else if (user.companyId && user.branchId) {
        const branchRoom = `co:${user.companyId}:br:${user.branchId}`;
        void client.join(branchRoom);

        if (user.role === Role.BRANCH_MANAGER) {
          // Branch manager joins branch room
        } else if (user.role === Role.KITCHEN || user.role === Role.STAFF) {
          void client.join(`${branchRoom}:kitchen`);
        } else if (user.role === Role.DELIVERY) {
          void client.join(`${branchRoom}:delivery`);
        }
      }

      logger.info({ userId: user.id, role: user.role }, 'Socket connected and rooms assigned');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown handshake error';
      logger.warn({ error: message }, 'WebSocket handshake rejected');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    logger.info({ clientId: client.id }, 'Socket disconnected');
  }

  /**
   * Client-emitted join requests are strictly dropped and logged (AUTHORIZATION_MODEL.md §9.1)
   */
  @SubscribeMessage('join')
  handleJoinRequest(client: Socket, payload: unknown) {
    logger.warn(
      { clientId: client.id, payload },
      'Unauthorized client join request ignored (rooms are server-decided)',
    );
    // Never call client.join(payload); return rejection notice
    return { status: 'rejected', reason: 'CLIENT_JOIN_FORBIDDEN' };
  }

  /**
   * Broadcasts new order creation event to branch and company rooms
   */
  broadcastNewOrder(companyId: string, branchId: string, payload: OrderSocketEventPayload) {
    const branchRoom = `co:${companyId}:br:${branchId}`;
    const companyRoom = `co:${companyId}`;

    this.server.to(branchRoom).to(companyRoom).emit('order:new', payload);
  }

  /**
   * Broadcasts order status transition event to branch, company, and role rooms
   */
  broadcastStatusChanged(
    companyId: string,
    branchId: string,
    payload: OrderSocketEventPayload,
  ) {
    const branchRoom = `co:${companyId}:br:${branchId}`;
    const companyRoom = `co:${companyId}`;

    this.server.to(branchRoom).to(companyRoom).emit('order:status_changed', payload);

    if (payload.toStatus === OrderStatus.READY_FOR_DELIVERY) {
      this.server.to(`${branchRoom}:delivery`).emit('delivery:order_ready', payload);
    }
  }
}
