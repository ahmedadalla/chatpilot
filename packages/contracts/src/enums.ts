/**
 * Canonical ChatPilot Roles (Single role per user in v1, D-16)
 */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  KITCHEN: 'KITCHEN',
  DELIVERY: 'DELIVERY',
  STAFF: 'STAFF',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Canonical Order Lifecycle Statuses (Q-REQ-3)
 */
export const OrderStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PREPARATION: 'IN_PREPARATION',
  READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED', // Terminal
  CANCELLED: 'CANCELLED', // Terminal
  FAILED_DELIVERY: 'FAILED_DELIVERY', // Terminal (reachable only from OUT_FOR_DELIVERY)
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

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
export const CompanyStatus = {
  INITIATED: 'INITIATED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type CompanyStatus = (typeof CompanyStatus)[keyof typeof CompanyStatus];

/**
 * Customer-selectable WhatsApp Onboarding Adapters (Q-REQ-4, D-21)
 */
export const WhatsAppProviderType = {
  CLOUD_API: 'CLOUD_API', // Official Meta Cloud API (Default)
  COEXISTENCE: 'COEXISTENCE', // Official Meta Business App Coexistence
  REGULAR_QR_PAIRING: 'REGULAR_QR_PAIRING', // Baileys multi-device pairing (Enabled)
} as const;
export type WhatsAppProviderType = (typeof WhatsAppProviderType)[keyof typeof WhatsAppProviderType];

/**
 * WhatsApp Connection Lifecycle Statuses
 */
export const WhatsAppConnectionStatus = {
  PAIRING_QR_READY: 'PAIRING_QR_READY',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  REQUIRES_REAUTH: 'REQUIRES_REAUTH',
} as const;
export type WhatsAppConnectionStatus =
  (typeof WhatsAppConnectionStatus)[keyof typeof WhatsAppConnectionStatus];

/**
 * Order Cancellation & Rejection Reason Enums
 */
export const OrderCancellationReason = {
  KITCHEN_REJECT: 'KITCHEN_REJECT',
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  AUTO_TIMEOUT: 'AUTO_TIMEOUT',
} as const;
export type OrderCancellationReason =
  (typeof OrderCancellationReason)[keyof typeof OrderCancellationReason];

export const DeliveryFailureReason = {
  CUSTOMER_UNREACHABLE: 'CUSTOMER_UNREACHABLE',
  ADDRESS_PROBLEM: 'ADDRESS_PROBLEM',
  ACCIDENT: 'ACCIDENT',
  ITEM_MISSING: 'ITEM_MISSING',
  OTHER: 'OTHER',
} as const;
export type DeliveryFailureReason =
  (typeof DeliveryFailureReason)[keyof typeof DeliveryFailureReason];

export const KbStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type KbStatus = (typeof KbStatus)[keyof typeof KbStatus];

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
