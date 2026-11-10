'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { MeResponseDto, Capability, Role } from '@chatpilot/contracts';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  user: MeResponseDto | null;
  role: Role | null;
  companyId: string | null;
  branchId: string | null;
  capabilities: Set<string>;
  hasCapability: (capability: Capability) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery<MeResponseDto>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<MeResponseDto>('/api/auth/me'),
    retry: false,
    staleTime: 60 * 1000,
  });

  const capabilities = React.useMemo(() => {
    return new Set(user?.capabilities || []);
  }, [user]);

  const hasCapability = React.useCallback(
    (cap: Capability) => {
      return capabilities.has(cap);
    },
    [capabilities],
  );

  const logout = React.useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Continue even if logout request fails
    } finally {
      queryClient.clear();
      router.push('/login');
    }
  }, [queryClient, router]);

  const refetchUser = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value: AuthContextValue = {
    user: user || null,
    role: user?.role || null,
    companyId: user?.companyId || null,
    branchId: user?.branchId || null,
    capabilities,
    hasCapability,
    isLoading,
    isAuthenticated: Boolean(user),
    logout,
    refetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
