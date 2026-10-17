import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { AvailabilityResolutionService } from '../../menu/availability-resolution.service';
import { PendingOrderService } from './pending-order.service';
import { OrderWorkflowService } from '../../order/order-workflow.service';
import {
  PendingOrderSummaryDto,
  PendingCartLineDto,
  OrderResponseDto,
} from '@chatpilot/contracts';

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityResolutionService: AvailabilityResolutionService,
    private readonly pendingOrderService: PendingOrderService,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  /**
   * get_menu tool: Returns authoritative categories and available items for the branch (ARCHITECTURE.md §7.3)
   */
  async getMenu(companyId: string, branchId: string) {
    return this.availabilityResolutionService.resolveBranchMenu(companyId, branchId);
  }

  /**
   * build_cart tool: Resolves authoritative prices from DB, checks branch min-order,
   * creates PendingOrder with 10-min expiration and confirmToken.
   * Model CANNOT alter prices or totals.
   */
  async buildCart(
    companyId: string,
    branchId: string,
    conversationId: string,
    requestedItems: Array<{ itemId: string; quantity: number }>,
  ): Promise<PendingOrderSummaryDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
      include: { company: { include: { settings: true } } },
    });

    if (!branch) {
      throw new NotFoundException('Active branch not found');
    }

    const lines: PendingCartLineDto[] = [];
    let subtotal = 0;

    for (const req of requestedItems) {
      const resolved = await this.availabilityResolutionService.resolveItem(
        companyId,
        branchId,
        req.itemId,
      );

      if (!resolved.isAvailable) {
        throw new UnprocessableEntityException(
          `Item "${resolved.name}" is currently unavailable at this branch`,
        );
      }

      const lineTotal = resolved.price * req.quantity;
      subtotal += lineTotal;

      lines.push({
        itemId: resolved.id,
        name: resolved.name,
        price: resolved.price,
        quantity: req.quantity,
        lineTotal,
      });
    }

    const minOrder = branch.minOrder ? Number(branch.minOrder) : 0;
    if (minOrder > 0 && subtotal < minOrder) {
      throw new UnprocessableEntityException({
        code: 'MINIMUM_ORDER_NOT_MET',
        message: `Order subtotal (${subtotal}) is below branch minimum order (${minOrder})`,
      });
    }

    const deliveryFee = branch.deliveryFee ? Number(branch.deliveryFee) : 0;
    const total = subtotal + deliveryFee;
    const currency = branch.company.settings?.defaultCurrency || 'EGP';

    const { pendingOrderId, confirmToken, expiresAt } =
      await this.pendingOrderService.createPendingOrder(
        companyId,
        branchId,
        conversationId,
        lines,
        { subtotal, deliveryFee, total, currency },
      );

    return {
      pendingOrderId,
      branchId,
      lines,
      subtotal,
      deliveryFee,
      total,
      currency,
      confirmToken,
      expiresAt,
    };
  }

  /**
   * create_order tool: Atomically consumes the PendingOrder if customer's confirmation token matches.
   * Creates official Order row via OrderWorkflowService.
   */
  async createOrderFromCart(
    pendingOrderId: string,
    confirmToken: string,
    callerCtx: InteractiveAuthContext,
    customerId?: string,
    address?: string,
    phone?: string,
  ): Promise<OrderResponseDto> {
    // 1. Consume pending order atomically (validates token and expiration)
    const consumed = await this.pendingOrderService.consumePendingOrder(
      pendingOrderId,
      confirmToken,
    );

    const lines = consumed.lines as unknown as PendingCartLineDto[];

    // 2. Delegate to OrderWorkflowService
    return this.orderWorkflowService.createOrder(callerCtx, {
      branchId: consumed.branchId,
      customerId,
      address,
      phone,
      paymentMethod: 'PAY_ON_DELIVERY',
      source: 'whatsapp',
      idempotencyKey: `pending_${consumed.id}`,
      items: lines.map((l) => ({
        menuItemId: l.itemId,
        quantity: l.quantity,
      })),
    });
  }

  /**
   * cancel_pending_order tool: Drops a pending cart proposal
   */
  async cancelPendingOrder(pendingOrderId: string): Promise<void> {
    await this.pendingOrderService.cancelPendingOrder(pendingOrderId);
  }

  /**
   * search_knowledge tool: Tenant-scoped search enforcing company_id filter before vector retrieval
   */
  async searchKnowledge(companyId: string, branchId: string | null, query: string) {
    return this.prisma.knowledgeChunk.findMany({
      where: {
        companyId,
        ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : { branchId: null }),
        content: { contains: query, mode: 'insensitive' },
      },
      take: 5,
    });
  }
}
