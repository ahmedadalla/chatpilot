import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderBoardService } from './order-board.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateOrderDto,
  RejectPendingOrderDto,
  CancelOrderDto,
  ReportDeliveryFailureDto,
  OrderStatus,
} from '@chatpilot/contracts';

@Controller('orders')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class OrderController {
  constructor(
    private readonly workflowService: OrderWorkflowService,
    private readonly boardService: OrderBoardService,
  ) {}

  @Post()
  @RequireCapabilities('orders:create')
  async createOrder(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateOrderDto,
  ) {
    return this.workflowService.createOrder(user, dto);
  }

  @Get()
  @RequireCapabilities('orders:read')
  async listOrders(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('branchId') branchId?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.boardService.listOrders(user, branchId, status);
  }

  @Get('kitchen/board')
  @RequireCapabilities('kitchen:board')
  async getKitchenBoard(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    const targetBranchId = user.branchId || branchId;
    return this.boardService.getKitchenBoard(user, targetBranchId!);
  }

  @Get('delivery/board')
  @RequireCapabilities('delivery:board')
  async getDeliveryBoard(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    const targetBranchId = user.branchId || branchId;
    return this.boardService.getDeliveryBoard(user, targetBranchId!);
  }

  // ----------------------------------------------------
  // Transitions
  // ----------------------------------------------------

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:accept')
  async accept(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
  ) {
    return this.workflowService.accept(user, orderId);
  }

  @Post(':id/reject-pending')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:cancel')
  async rejectPending(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
    @Body() dto: RejectPendingOrderDto,
  ) {
    return this.workflowService.rejectPending(user, orderId, dto);
  }

  @Post(':id/start-prep')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:start-prep')
  async startPreparation(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
  ) {
    return this.workflowService.startPreparation(user, orderId);
  }

  @Post(':id/mark-ready')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:ready')
  async markReady(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
  ) {
    return this.workflowService.markReady(user, orderId);
  }

  @Post(':id/start-delivery')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:start-delivery')
  async startDelivery(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
  ) {
    return this.workflowService.startDelivery(user, orderId);
  }

  @Post(':id/mark-delivered')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:complete')
  async markDelivered(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
  ) {
    return this.workflowService.markDelivered(user, orderId);
  }

  @Post(':id/report-failure')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:fail-delivery')
  async reportDeliveryFailure(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
    @Body() dto: ReportDeliveryFailureDto,
  ) {
    return this.workflowService.reportDeliveryFailure(user, orderId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('orders:transition:cancel')
  async adminCancel(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.workflowService.adminCancel(user, orderId, dto);
  }
}
