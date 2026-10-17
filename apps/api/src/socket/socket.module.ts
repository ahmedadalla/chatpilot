import { Module } from '@nestjs/common';
import { OrderEventsGateway } from './order-events.gateway';
import { SocketTokenService } from './socket-token.service';
import { PrismaService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [OrderEventsGateway, SocketTokenService, PrismaService],
  exports: [OrderEventsGateway, SocketTokenService],
})
export class SocketModule {}
