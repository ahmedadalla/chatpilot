import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { AvailabilityResolutionService } from '../menu/availability-resolution.service';
import { OrderEventsGateway } from '../socket/order-events.gateway';
import {
  OrderStatus,
  Role,
  TERMINAL_ORDER_STATUSES,
  OrderCancellationReason,
  DeliveryFailureReason,
  CreateOrderDto,
  RejectPendingOrderDto,
  CancelOrderDto,
  ReportDeliveryFailureDto,
  OrderResponseDto,
} from '@chatpilot/contracts';

@Injectable()
export class OrderWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityResolutionService: AvailabilityResolutionService,
    private readonly orderEventsGateway: OrderEventsGateway,
  ) {}

  /**
   * Creates a new Order transactionally with price resolution, sequential numbering & idempotency (D-8, D-10)
   */
  async createOrder(
    callerCtx: InteractiveAuthContext,
    dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const branchId = dto.branchId;

    // Verify caller branch scope for branch-level staff
    if (callerCtx.branchId && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    // 1. Idempotency Check (23505 collision returns existing order with 200, never 500)
    if (dto.idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true, statusHistory: true },
      });
      if (existingOrder) {
        return this.mapOrderToDto(existingOrder);
      }
    }

    // 2. Fetch branch & verify company ownership
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId: callerCtx.companyId! },
      include: { company: { include: { settings: true } } },
    });

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Active branch not found');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // 3. Authoritative item resolution (AvailabilityResolutionService)
    const lineSnapshots: Array<{
      menuItemId: string;
      nameSnapshot: string;
      unitPriceSnapshot: number;
      quantity: number;
      lineTotal: number;
      notes: string | null;
    }> = [];

    let subtotal = 0;

    for (const itemDto of dto.items) {
      if (!itemDto.quantity || itemDto.quantity <= 0) {
        throw new BadRequestException('Item quantity must be greater than 0');
      }

      const resolved = await this.availabilityResolutionService.resolveItem(
        callerCtx.companyId!,
        branchId,
        itemDto.menuItemId,
      );

      if (!resolved.isAvailable) {
        throw new UnprocessableEntityException(
          `Item "${resolved.name}" is currently unavailable at this branch`,
        );
      }

      const lineTotal = resolved.price * itemDto.quantity;
      subtotal += lineTotal;

      lineSnapshots.push({
        menuItemId: resolved.id,
        nameSnapshot: resolved.name,
        unitPriceSnapshot: resolved.price,
        quantity: itemDto.quantity,
        lineTotal,
        notes: itemDto.notes?.trim() || null,
      });
    }

    // 4. Validate minimum order
    const minOrder = branch.minOrder ? Number(branch.minOrder) : 0;
    if (minOrder > 0 && subtotal < minOrder) {
      throw new UnprocessableEntityException({
        code: 'MINIMUM_ORDER_NOT_MET',
        message: `Order subtotal (${subtotal}) is less than branch minimum order (${minOrder})`,
      });
    }

    const deliveryFee = branch.deliveryFee ? Number(branch.deliveryFee) : 0;
    const discount = 0;
    const total = subtotal + deliveryFee - discount;
    const currency = branch.company.settings?.defaultCurrency || 'EGP';

    // 5. Compute calendar date in branch's IANA timezone (D-10)
    const sequenceDayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: branch.timezone || 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()); // YYYY-MM-DD
    const sequenceDay = new Date(sequenceDayStr);

    // 6. Execute atomic creation inside a transaction
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // Allocate sequential order number atomically
      const counter = await tx.branchDayCounter.upsert({
        where: {
          branchId_sequenceDay: {
            branchId,
            sequenceDay,
          },
        },
        create: {
          branchId,
          sequenceDay,
          seq: 1,
        },
        update: {
          seq: { increment: 1 },
        },
      });

      const yyyymmdd = sequenceDayStr.replace(/-/g, '');
      const paddedSeq = String(counter.seq).padStart(4, '0');
      const orderNumber = `BR-${branch.code}-${yyyymmdd}-${paddedSeq}`;

      const order = await tx.order.create({
        data: {
          companyId: callerCtx.companyId!,
          branchId,
          orderNumber,
          sequenceDay,
          status: OrderStatus.PENDING,
          currency,
          subtotal,
          deliveryFee,
          discount,
          total,
          customerId: dto.customerId || null,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          notes: dto.notes?.trim() || null,
          paymentMethod: dto.paymentMethod || 'PAY_ON_DELIVERY',
          source: dto.source || 'whatsapp',
          idempotencyKey: dto.idempotencyKey || null,
          items: {
            create: lineSnapshots,
          },
          statusHistory: {
            create: {
              fromStatus: OrderStatus.PENDING,
              toStatus: OrderStatus.PENDING,
              actorUserId: callerCtx.userId,
              actorRole: callerCtx.role,
              reason: 'Order Created',
            },
          },
        },
        include: {
          items: true,
          statusHistory: true,
        },
      });

      return order;
    });

    // 7. Post-commit event broadcast
    this.orderEventsGateway.broadcastNewOrder(callerCtx.companyId!, branchId, {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      branchId: createdOrder.branchId,
      toStatus: OrderStatus.PENDING,
      occurredAt: createdOrder.createdAt,
    });

    return this.mapOrderToDto(createdOrder);
  }

  // ----------------------------------------------------
  // Canonical State Machine Transitions (ARCHITECTURE.md §5.2)
  // ----------------------------------------------------

  /**
   * PENDING → ACCEPTED (Allowed: KITCHEN, STAFF)
   */
  async accept(callerCtx: InteractiveAuthContext, orderId: string) {
    if (callerCtx.role !== Role.KITCHEN && callerCtx.role !== Role.STAFF) {
      throw new ForbiddenException('Only Kitchen or Staff can accept pending orders');
    }
    return this.executeTransition(
      callerCtx,
      orderId,
      'accept',
      [OrderStatus.PENDING],
      OrderStatus.ACCEPTED,
    );
  }

  /**
   * PENDING → CANCELLED (Allowed: KITCHEN, STAFF; DELIVERY is blocked with 403)
   */
  async rejectPending(
    callerCtx: InteractiveAuthContext,
    orderId: string,
    dto: RejectPendingOrderDto,
  ) {
    if (callerCtx.role === Role.DELIVERY) {
      throw new ForbiddenException('Delivery role has no access to reject pending orders');
    }
    if (callerCtx.role !== Role.KITCHEN && callerCtx.role !== Role.STAFF) {
      throw new ForbiddenException('Only Kitchen or Staff can reject pending orders');
    }
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Rejection reason text is required');
    }

    return this.executeTransition(
      callerCtx,
      orderId,
      'reject_pending',
      [OrderStatus.PENDING],
      OrderStatus.CANCELLED,
      OrderCancellationReason.KITCHEN_REJECT,
      dto.reason.trim(),
    );
  }

  /**
   * ACCEPTED → IN_PREPARATION (Allowed: KITCHEN only; STAFF blocked with 403)
   */
  async startPreparation(callerCtx: InteractiveAuthContext, orderId: string) {
    if (callerCtx.role !== Role.KITCHEN) {
      throw new ForbiddenException('Only Kitchen staff can start preparation');
    }
    return this.executeTransition(
      callerCtx,
      orderId,
      'start_preparation',
      [OrderStatus.ACCEPTED],
      OrderStatus.IN_PREPARATION,
    );
  }

  /**
   * IN_PREPARATION → READY_FOR_DELIVERY (Allowed: KITCHEN only; STAFF blocked with 403)
   */
  async markReady(callerCtx: InteractiveAuthContext, orderId: string) {
    if (callerCtx.role !== Role.KITCHEN) {
      throw new ForbiddenException('Only Kitchen staff can mark orders ready');
    }
    return this.executeTransition(
      callerCtx,
      orderId,
      'mark_ready',
      [OrderStatus.IN_PREPARATION],
      OrderStatus.READY_FOR_DELIVERY,
    );
  }

  /**
   * READY_FOR_DELIVERY → OUT_FOR_DELIVERY (Allowed: DELIVERY only)
   */
  async startDelivery(callerCtx: InteractiveAuthContext, orderId: string) {
    if (callerCtx.role !== Role.DELIVERY) {
      throw new ForbiddenException('Only Delivery drivers can start delivery');
    }
    return this.executeTransition(
      callerCtx,
      orderId,
      'start_delivery',
      [OrderStatus.READY_FOR_DELIVERY],
      OrderStatus.OUT_FOR_DELIVERY,
    );
  }

  /**
   * OUT_FOR_DELIVERY → DELIVERED (Allowed: DELIVERY only; Terminal state)
   */
  async markDelivered(callerCtx: InteractiveAuthContext, orderId: string) {
    if (callerCtx.role !== Role.DELIVERY) {
      throw new ForbiddenException('Only Delivery drivers can complete delivery');
    }
    return this.executeTransition(
      callerCtx,
      orderId,
      'mark_delivered',
      [OrderStatus.OUT_FOR_DELIVERY],
      OrderStatus.DELIVERED,
    );
  }

  /**
   * OUT_FOR_DELIVERY → FAILED_DELIVERY (Allowed: DELIVERY, BRANCH_MANAGER; Terminal state)
   */
  async reportDeliveryFailure(
    callerCtx: InteractiveAuthContext,
    orderId: string,
    dto: ReportDeliveryFailureDto,
  ) {
    if (callerCtx.role !== Role.DELIVERY && callerCtx.role !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException('Only Delivery or Branch Manager can report delivery failure');
    }
    if (!dto.reasonCode || !dto.reasonText) {
      throw new BadRequestException('Reason code and explanation text are required');
    }

    return this.executeTransition(
      callerCtx,
      orderId,
      'report_delivery_failure',
      [OrderStatus.OUT_FOR_DELIVERY],
      OrderStatus.FAILED_DELIVERY,
      dto.reasonCode,
      dto.reasonText.trim(),
    );
  }

  /**
   * Non-terminal → CANCELLED (Allowed: COMPANY_ADMIN, BRANCH_MANAGER; Terminal state)
   */
  async adminCancel(
    callerCtx: InteractiveAuthContext,
    orderId: string,
    dto: CancelOrderDto,
  ) {
    if (callerCtx.role !== Role.COMPANY_ADMIN && callerCtx.role !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException('Only Company Admin or Branch Manager can cancel orders');
    }
    if (!dto.reasonCode || !dto.reasonText) {
      throw new UnprocessableEntityException('Reason code and explanation text are required for cancellation');
    }

    return this.executeTransition(
      callerCtx,
      orderId,
      'admin_cancel',
      [
        OrderStatus.PENDING,
        OrderStatus.ACCEPTED,
        OrderStatus.IN_PREPARATION,
        OrderStatus.READY_FOR_DELIVERY,
      ],
      OrderStatus.CANCELLED,
      dto.reasonCode,
      dto.reasonText.trim(),
    );
  }

  // ----------------------------------------------------
  // Concurrency-Safe Transition Executor (D-8)
  // ----------------------------------------------------

  private async executeTransition(
    callerCtx: InteractiveAuthContext,
    orderId: string,
    action: string,
    allowedFromStatuses: OrderStatus[],
    toStatus: OrderStatus,
    reasonCode?: string,
    reasonText?: string,
  ): Promise<OrderResponseDto> {
    // 1. Same-Actor Replay Check: If this actor already executed this action, return stored result (200 OK)
    const existingToken = await this.prisma.orderTransitionToken.findUnique({
      where: {
        orderId_action_actorUserId: {
          orderId,
          action,
          actorUserId: callerCtx.userId,
        },
      },
    });

    if (existingToken && existingToken.result) {
      return existingToken.result as unknown as OrderResponseDto;
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Fetch current order to check existence and terminality
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, statusHistory: true },
      });

      if (!currentOrder || currentOrder.companyId !== callerCtx.companyId) {
        throw new NotFoundException('Order not found');
      }

      // Branch scope validation for branch-level staff
      if (callerCtx.branchId && currentOrder.branchId !== callerCtx.branchId) {
        throw new NotFoundException('Order not found');
      }

      // Terminal state check: No transition may originate from terminal states
      if (TERMINAL_ORDER_STATUSES.has(currentOrder.status)) {
        throw new UnprocessableEntityException(
          `Cannot transition order: Order is in terminal state "${currentOrder.status}"`,
        );
      }

      // 3. Atomic Conditional Update (Single Winner Guarantee, D-8)
      // UPDATE "orders" SET status = :toStatus WHERE id = :orderId AND status IN (:fromStatuses)
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: { in: allowedFromStatuses },
        },
        data: {
          status: toStatus,
          updatedAt: new Date(),
        },
      });

      // If 0 rows updated: competing actor won the race or order is in conflicting state
      if (updateResult.count === 0) {
        // Re-read current status to determine 409 Conflict vs 422
        const fresh = await tx.order.findUnique({ where: { id: orderId } });
        if (fresh && fresh.status !== currentOrder.status) {
          throw new ConflictException({
            code: 'CONCURRENT_TRANSITION_CONFLICT',
            message: `Competing actor transitioned order to "${fresh.status}"; please refresh the board`,
          });
        }
        throw new UnprocessableEntityException(
          `Invalid state transition: Order status "${currentOrder.status}" cannot transition to "${toStatus}"`,
        );
      }

      // 4. Record status history append-only
      const reason = reasonCode ? (reasonText ? `${reasonCode}: ${reasonText}` : reasonCode) : reasonText;
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentOrder.status,
          toStatus,
          actorUserId: callerCtx.userId,
          actorRole: callerCtx.role,
          reason: reason || null,
        },
      });

      // 5. Fetch updated order
      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, statusHistory: true },
      });

      const responseDto = this.mapOrderToDto(updatedOrder);

      // 6. Record OrderTransitionToken claim for same-actor idempotent replay
      await tx.orderTransitionToken.upsert({
        where: {
          orderId_action_actorUserId: {
            orderId,
            action,
            actorUserId: callerCtx.userId,
          },
        },
        create: {
          orderId,
          action,
          actorUserId: callerCtx.userId,
          status: toStatus,
          result: responseDto as any,
        },
        update: {
          status: toStatus,
          result: responseDto as any,
        },
      });

      // 7. Post-commit event emission via Socket.IO
      this.orderEventsGateway.broadcastStatusChanged(callerCtx.companyId!, currentOrder.branchId, {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        branchId: updatedOrder.branchId,
        fromStatus: currentOrder.status,
        toStatus,
        occurredAt: new Date(),
      });

      return responseDto;
    });
  }

  private mapOrderToDto(order: any): OrderResponseDto {
    return {
      id: order.id,
      companyId: order.companyId,
      branchId: order.branchId,
      orderNumber: order.orderNumber,
      sequenceDay: order.sequenceDay,
      status: order.status,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      discount: Number(order.discount || 0),
      total: Number(order.total),
      customerId: order.customerId,
      address: order.address,
      phone: order.phone,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      source: order.source,
      idempotencyKey: order.idempotencyKey,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items?.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        nameSnapshot: item.nameSnapshot,
        unitPriceSnapshot: Number(item.unitPriceSnapshot),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        notes: item.notes,
      })),
      statusHistory: order.statusHistory?.map((h: any) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorUserId: h.actorUserId,
        actorRole: h.actorRole,
        reason: h.reason,
        occurredAt: h.occurredAt,
      })),
    };
  }
}
