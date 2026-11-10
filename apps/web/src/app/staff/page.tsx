'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { useAuth } from '../../providers/auth-provider';
import { AppShell } from '../../components/layout/app-shell';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/dialog';
import { TableSkeleton } from '../../components/ui/loading-skeleton';
import { useToast } from '../../components/ui/toast';
import { formatTime } from '../../lib/utils';
import { KitchenBoardOrderDto, OrderStatus, OrderCancellationReason } from '@chatpilot/contracts';
import { ShoppingBag, Check, X, Clock } from 'lucide-react';

export default function StaffIntakePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [rejectTargetId, setRejectTargetId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState<OrderCancellationReason>(
    OrderCancellationReason.KITCHEN_REJECT,
  );

  const {
    data: boardOrders = [],
    isLoading,
    refetch,
  } = useQuery<KitchenBoardOrderDto[]>({
    queryKey: ['staff', 'intake', branchId],
    queryFn: () =>
      api.get<KitchenBoardOrderDto[]>(`/api/orders/kitchen/board?branchId=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 10000,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'intake'] });
      success('تم قبول وتأكيد الطلب وتحويله للمطبخ');
    },
    onError: (err: any) => toastError('فشل قبول الطلب', err?.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: any) => api.post(`/api/orders/${id}/reject-pending`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'intake'] });
      setRejectTargetId(null);
      success('تم رفض الطلب');
    },
    onError: (err: any) => toastError('فشل رفض الطلب', err?.message),
  });

  const pendingOrders = boardOrders.filter((o) => o.status === OrderStatus.PENDING);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-emerald-600" />
              طابور استقبال وتأكيد الطلبات (Staff Intake)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مراجعة الطلبات الواردة فورياً وتأكيدها للمطبخ أو رفضها مع توضيح السبب
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            تحديث القائمة
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>الطلبات الواردة بانتظار التأكيد ({pendingOrders.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="border-2 border-emerald-200 bg-white shadow-xs">
                  <CardHeader className="p-4 pb-2 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg font-black text-slate-900">
                        #{order.orderNumber}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(order.createdAt)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="divide-y divide-slate-100 text-xs">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex justify-between font-medium">
                          <span>{it.name}</span>
                          <span className="font-bold text-slate-900">× {it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p className="text-[11px] p-2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        ملاحظة: {order.notes}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRejectTargetId(order.id)}
                        className="h-9 font-semibold text-xs"
                      >
                        <X className="me-1 h-3.5 w-3.5" />
                        رفض
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(order.id)}
                        loading={acceptMutation.isPending}
                        className="h-9 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="me-1 h-3.5 w-3.5" />
                        تأكيد وقبول
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {pendingOrders.length === 0 && (
                <div className="col-span-full p-12 text-center rounded-xl bg-white border border-dashed border-slate-300 text-xs text-slate-400">
                  لا توجد طلبات جديدة معلقة بانتظار التأكيد حالياً.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        <Dialog
          open={Boolean(rejectTargetId)}
          onOpenChange={(open) => !open && setRejectTargetId(null)}
          title="رفض الطلب"
        >
          <div className="space-y-4">
            <Select
              label="سبب الرفض"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as OrderCancellationReason)}
              options={[
                {
                  label: 'رفض من المطعم (Kitchen Reject)',
                  value: OrderCancellationReason.KITCHEN_REJECT,
                },
                {
                  label: 'طلب العميل الإلغاء (Customer Request)',
                  value: OrderCancellationReason.CUSTOMER,
                },
                { label: 'إلغاء إداري (Admin)', value: OrderCancellationReason.ADMIN },
              ]}
            />

            <Button
              variant="destructive"
              className="w-full h-10 font-bold"
              loading={rejectMutation.isPending}
              onClick={() => {
                if (rejectTargetId) {
                  rejectMutation.mutate({
                    id: rejectTargetId,
                    reason: rejectReason,
                  });
                }
              }}
            >
              تأكيد الرفض
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
