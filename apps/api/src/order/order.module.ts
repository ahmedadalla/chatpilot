import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderBoardService } from './order-board.service';
import { MenuModule } from '../menu/menu.module';
import { SocketModule } from '../socket/socket.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@chatpilot/database';

@Module({
  imports: [MenuModule, SocketModule, AuthModule],
  controllers: [OrderController],
  providers: [OrderWorkflowService, OrderBoardService, PrismaService],
  exports: [OrderWorkflowService, OrderBoardService],
})
export class OrderModule {}
