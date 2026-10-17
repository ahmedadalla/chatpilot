import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import {
  OrderStatus,
  Role,
  KitchenBoardOrderDto,
  DeliveryBoardOrderDto,
  OrderResponseDto,
} from '@chatpilot/contracts';

@Injectable()
export class OrderBoardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kitchen board: PENDING, ACCEPTED, IN_PREPARATION orders for the branch (ARCHITECTURE.md §4.1)
   */
  async getKitchenBoard(
    callerCtx: InteractiveAuthContext,
    branchId: string,
  ): Promise<KitchenBoardOrderDto[]> {
    if (callerCtx.branchId && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        companyId: callerCtx.companyId!,
        branchId,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.ACCEPTED,
            OrderStatus.IN_PREPARATION,
          ],
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      itemCount: o.items.length,
      items: o.items.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        notes: i.notes,
      })),
      notes: o.notes,
    }));
  }

  /**
   * Delivery board: READY_FOR_DELIVERY, OUT_FOR_DELIVERY orders for the branch (ARCHITECTURE.md §4.1)
   */
  async getDeliveryBoard(
    callerCtx: InteractiveAuthContext,
    branchId: string,
  ): Promise<DeliveryBoardOrderDto[]> {
    if (callerCtx.branchId && callerCtx.branchId !== branchId) {
      throw new NotFoundException('Branch not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        companyId: callerCtx.companyId!,
        branchId,
        status: {
          in: [
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      address: o.address,
      phone: o.phone,
      total: Number(o.total),
      currency: o.currency,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
    }));
  }

  /**
   * General order list query:
   * For DELIVERY role: restricted strictly to READY_FOR_DELIVERY and OUT_FOR_DELIVERY (IMPLEMENTATION_PLAN.md Phase 5)
   */
  async listOrders(
    callerCtx: InteractiveAuthContext,
    branchId?: string,
    statusFilter?: OrderStatus,
  ): Promise<OrderResponseDto[]> {
    const targetBranchId = callerCtx.branchId || branchId;

    // DELIVERY role constraint: only READY_FOR_DELIVERY and OUT_FOR_DELIVERY
    let allowedStatuses: OrderStatus[] | undefined = undefined;
    if (callerCtx.role === Role.DELIVERY) {
      allowedStatuses = [OrderStatus.READY_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY];
    } else if (statusFilter) {
      allowedStatuses = [statusFilter];
    }

    const orders = await this.prisma.order.findMany({
      where: {
        companyId: callerCtx.companyId!,
        ...(targetBranchId && { branchId: targetBranchId }),
        ...(allowedStatuses && { status: { in: allowedStatuses } }),
      },
      include: {
        items: true,
        statusHistory: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => ({
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
      items: order.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        nameSnapshot: i.nameSnapshot,
        unitPriceSnapshot: Number(i.unitPriceSnapshot),
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
        notes: i.notes,
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorUserId: h.actorUserId,
        actorRole: h.actorRole,
        reason: h.reason,
        occurredAt: h.occurredAt,
      })),
    }));
  }
}
