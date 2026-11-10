'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { Card, CardHeader, CardContent } from '../../../../components/ui/card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { formatCurrency } from '../../../../lib/utils';
import { DeliveryBoardOrderDto, OrderStatus } from '@chatpilot/contracts';
import { Bike, Phone, MapPin } from 'lucide-react';

export default function BranchDeliveryMonitorPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    data: boardOrders = [],
    isLoading,
    error,
    refetch,
  } = useQuery<DeliveryBoardOrderDto[]>({
    queryKey: ['delivery', 'board', branchId],
    queryFn: () =>
      api.get<DeliveryBoardOrderDto[]>(`/api/orders/delivery/board?branchId=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 10000,
  });

  const readyOrders = boardOrders.filter((o) => o.status === OrderStatus.READY_FOR_DELIVERY);
  const outOrders = boardOrders.filter((o) => o.status === OrderStatus.OUT_FOR_DELIVERY);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Bike className="h-6 w-6 text-emerald-600" />
              مراقبة حركة التوصيل الحية (Delivery Live Monitor)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              متابعة مباشرة للطلبات الجاهزة بانتظار الخروج والطلبات الموجودة مع المناديب
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            شاشة قراءة إشرافية فقط
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lane 1: Ready for Delivery */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  جاهزة للتسليم للمندوب ({readyOrders.length})
                </span>
              </div>

              <div className="space-y-3">
                {readyOrders.map((order) => (
                  <Card key={order.id} className="border-emerald-200 bg-emerald-50/20">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{order.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{order.address || 'استلام من المطعم'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {readyOrders.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    لا توجد طلبات جاهزة بانتظار الخروج.
                  </p>
                )}
              </div>
            </div>

            {/* Lane 2: Out for Delivery */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                  في الطريق مع المناديب ({outOrders.length})
                </span>
              </div>

              <div className="space-y-3">
                {outOrders.map((order) => (
                  <Card key={order.id} className="border-blue-200 bg-blue-50/20">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{order.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{order.address || 'استلام من المطعم'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {outOrders.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    لا توجد طلبات في مسار التوصيل حالياً.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
