'use client';

import { useAuth } from '../providers/auth-provider';
import { Role } from '@chatpilot/contracts';

export function usePermissions() {
  const { user, role, hasCapability, isAuthenticated, isLoading } = useAuth();

  const isSuperAdmin = role === Role.SUPER_ADMIN;
  const isCompanyAdmin = role === Role.COMPANY_ADMIN;
  const isBranchManager = role === Role.BRANCH_MANAGER;
  const isKitchen = role === Role.KITCHEN;
  const isDelivery = role === Role.DELIVERY;
  const isStaff = role === Role.STAFF;

  const canManageBranch = isCompanyAdmin || isBranchManager;
  const canAccessFinancials = hasCapability('analytics:financial:read');
  const canPerformKitchenOps = hasCapability('orders:transition:start-prep');
  const canPerformDeliveryOps = hasCapability('orders:transition:start-delivery');

  return {
    user,
    role,
    isAuthenticated,
    isLoading,
    hasCapability,
    isSuperAdmin,
    isCompanyAdmin,
    isBranchManager,
    isKitchen,
    isDelivery,
    isStaff,
    canManageBranch,
    canAccessFinancials,
    canPerformKitchenOps,
    canPerformDeliveryOps,
  };
}
