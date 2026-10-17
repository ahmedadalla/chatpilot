import { OrderStatus, OrderCancellationReason, DeliveryFailureReason } from './enums';

export interface CreateOrderItemDto {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface CreateOrderDto {
  branchId: string;
  items: CreateOrderItemDto[];
  customerId?: string;
  address?: string;
  phone?: string;
  notes?: string;
  paymentMethod?: string;
  source?: string;
  idempotencyKey?: string;
}

export interface RejectPendingOrderDto {
  reason: string;
}

export interface CancelOrderDto {
  reasonCode: OrderCancellationReason;
  reasonText: string;
}

export interface ReportDeliveryFailureDto {
  reasonCode: DeliveryFailureReason;
  reasonText: string;
}

export interface OrderItemResponseDto {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
}

export interface OrderStatusHistoryResponseDto {
  id: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: string | null;
  actorRole: string;
  reason: string | null;
  occurredAt: Date;
}

export interface OrderResponseDto {
  id: string;
  companyId: string;
  branchId: string;
  orderNumber: string;
  sequenceDay: Date;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  customerId: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  paymentMethod: string;
  source: string;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItemResponseDto[];
  statusHistory?: OrderStatusHistoryResponseDto[];
}

export interface KitchenBoardOrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  itemCount: number;
  items: Array<{
    name: string;
    quantity: number;
    notes: string | null;
  }>;
  notes: string | null;
}

export interface DeliveryBoardOrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  address: string | null;
  phone: string | null;
  total: number;
  currency: string;
  paymentMethod: string;
  createdAt: Date;
}

export interface OrderSocketEventPayload {
  orderId: string;
  orderNumber: string;
  branchId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  occurredAt: Date;
}
