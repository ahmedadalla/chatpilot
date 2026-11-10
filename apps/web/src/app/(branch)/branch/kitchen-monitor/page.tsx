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
import { formatTime } from '../../../../lib/utils';
import { KitchenBoardOrderDto, OrderStatus } from '@chatpilot/contracts';
import { ChefHat, Clock } from 'lucide-react';

export default function BranchKitchenMonitorPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    data: boardOrders = [],
    isLoading,
    error,
    refetch,
  } = useQuery<KitchenBoardOrderDto[]>({
    queryKey: ['kitchen', 'board', branchId],
    queryFn: () =>
      api.get<KitchenBoardOrderDto[]>(`/api/orders/kitchen/board?branchId=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 10000,
  });

  const pendingOrders = boardOrders.filter((o) => o.status === OrderStatus.PENDING);
  const inPrepOrders = boardOrders.filter(
    (o) => o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.IN_PREPARATION,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-amber-600" />
              مراقبة المطبخ الحية (Kitchen Live Monitor)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              شاشة مراقبة إشرافية لمدير الفرع لمتابعة زمن التحضير وسرعة إنجاز الطهاة
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            شاشة قراءة إشرافية فقط
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lane 1: Pending Intake */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  بانتظار التأكيد ({pendingOrders.length})
                </span>
              </div>

              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="border-amber-200 bg-amber-50/20">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <div className="divide-y divide-amber-100 text-xs">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span className="font-bold text-slate-800">{it.name}</span>
                            <span className="font-semibold text-slate-600">× {it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pendingOrders.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    لا توجد طلبات جديدة معلقة.
                  </p>
                )}
              </div>
            </div>

            {/* Lane 2: In Preparation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                  قيد التحضير في المطبخ ({inPrepOrders.length})
                </span>
              </div>

              <div className="space-y-3">
                {inPrepOrders.map((order) => (
                  <Card key={order.id} className="border-blue-200 bg-blue-50/20">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <div className="divide-y divide-blue-100 text-xs">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span className="font-bold text-slate-800">{it.name}</span>
                            <span className="font-semibold text-slate-600">× {it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {inPrepOrders.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    المطبخ خالٍ من الطلبات قيد التحضير.
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
