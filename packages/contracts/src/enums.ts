/**
 * Canonical ChatPilot Roles (Single role per user in v1, D-16)
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  KITCHEN = 'KITCHEN',
  DELIVERY = 'DELIVERY',
  STAFF = 'STAFF',
}

/**
 * Canonical Order Lifecycle Statuses (Q-REQ-3)
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  IN_PREPARATION = 'IN_PREPARATION',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED', // Terminal
  CANCELLED = 'CANCELLED', // Terminal
  FAILED_DELIVERY = 'FAILED_DELIVERY', // Terminal (reachable only from OUT_FOR_DELIVERY)
}

/**
 * Terminal Order Statuses Set
 */
export const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED_DELIVERY,
]);

/**
 * Company Lifecycle Statuses
 */
export enum CompanyStatus {
  INITIATED = 'INITIATED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Customer-selectable WhatsApp Onboarding Adapters (Q-REQ-4, D-21)
 */
export enum WhatsAppProviderType {
  CLOUD_API = 'CLOUD_API', // Official Meta Cloud API (Default)
  COEXISTENCE = 'COEXISTENCE', // Official Meta Business App Coexistence
  REGULAR_QR_PAIRING = 'REGULAR_QR_PAIRING', // Baileys multi-device pairing (Enabled)
}

/**
 * WhatsApp Connection Lifecycle Statuses
 */
export enum WhatsAppConnectionStatus {
  PAIRING_QR_READY = 'PAIRING_QR_READY',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  REQUIRES_REAUTH = 'REQUIRES_REAUTH',
}

/**
 * Order Cancellation & Rejection Reason Enums
 */
export enum OrderCancellationReason {
  KITCHEN_REJECT = 'KITCHEN_REJECT',
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  AUTO_TIMEOUT = 'AUTO_TIMEOUT',
}

export enum DeliveryFailureReason {
  CUSTOMER_UNREACHABLE = 'CUSTOMER_UNREACHABLE',
  ADDRESS_PROBLEM = 'ADDRESS_PROBLEM',
  ACCIDENT = 'ACCIDENT',
  ITEM_MISSING = 'ITEM_MISSING',
  OTHER = 'OTHER',
}
