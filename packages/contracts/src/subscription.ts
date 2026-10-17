import { SubscriptionStatus } from './enums';

export interface PlanLimitsDto {
  ordersPerMonth: number;
  tokensPerDay: number;
  branchesLimit: number;
}

export interface PlanDto {
  id: string;
  code: string;
  name: string;
  limits: PlanLimitsDto;
  createdAt: Date;
}

export interface CreatePlanDto {
  code: string;
  name: string;
  limits: PlanLimitsDto;
}

export interface AssignSubscriptionDto {
  companyId: string;
  planId: string;
}

export interface SubscriptionResponseDto {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  plan: PlanDto;
}

export interface CompanyUsageViewDto {
  companyId: string;
  currentOrdersMonth: number;
  ordersLimit: number;
  percentOrdersUsed: number;
  currentTokensToday: number;
  tokensLimit: number;
  planCode: string;
  isOverLimit: boolean;
}
