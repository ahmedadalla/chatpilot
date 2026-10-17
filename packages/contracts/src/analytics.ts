export interface OperationalMetricsDto {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedDeliveryOrders: number;
  activeOrders: number;
  avgPrepDurationMinutes: number;
  avgDeliveryDurationMinutes: number;
}

export interface FinancialMetricsDto {
  gmvSubtotal: number;
  gmvDelivery: number;
  gmvTotal: number;
  avgOrderValue: number;
  currency: string;
  cancellationLoss: number;
}

export interface BranchOperationalResponseDto {
  branchId: string;
  operational: OperationalMetricsDto;
}

export interface BranchFinancialResponseDto {
  branchId: string;
  financial: FinancialMetricsDto;
}

export interface CompanyAnalyticsResponseDto {
  companyId: string;
  operational: OperationalMetricsDto;
  financial: FinancialMetricsDto;
  totalMessages: number;
  aiTokensUsed: number;
}

export interface PlatformAnalyticsResponseDto {
  day: Date;
  totalCompanies: number;
  activeCompanies: number;
  totalBranches: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedDeliveryOrders: number;
  gmvByCurrency: Record<string, number>; // Per-currency restaurant GMV (D-11, D-20)
  saasMrrActiveCompanies: number; // SaaS MRR structurally separated from GMV
}
