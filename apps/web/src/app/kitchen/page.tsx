'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { useAuth } from '../../providers/auth-provider';
import { useSocket } from '../../providers/socket-provider';
import { AppShell } from '../../components/layout/app-shell';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/dialog';
import { TableSkeleton } from '../../components/ui/loading-skeleton';
import { useToast } from '../../components/ui/toast';
import { formatTime } from '../../lib/utils';
import { KitchenBoardOrderDto, OrderStatus, OrderCancellationReason } from '@chatpilot/contracts';
import { ChefHat, Check, X, Clock, Play, CheckCircle2 } from 'lucide-react';

export default function KitchenBoardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { status: socketStatus } = useSocket();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [rejectTargetId, setRejectTargetId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState<OrderCancellationReason>(
    OrderCancellationReason.KITCHEN_REJECT,
  );
  const [rejectNotes, setRejectNotes] = React.useState('');

  const {
    data: boardOrders = [],
    isLoading,
    refetch,
  } = useQuery<KitchenBoardOrderDto[]>({
    queryKey: ['kitchen', 'board', branchId],
    queryFn: () =>
      api.get<KitchenBoardOrderDto[]>(`/api/orders/kitchen/board?branchId=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 10000,
  });

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      success('تم قبول الطلب وبدء استلام المطبخ');
    },
    onError: (err: any) => toastError('فشل قبول الطلب', err?.message),
  });

  const startPrepMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/start-prep`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      success('تم بدء تحضير الطلب في المطبخ');
    },
    onError: (err: any) => toastError('تعذر بدء التحضير', err?.message),
  });

  const markReadyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/mark-ready`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      success('الطلب جاهز للتسليم لمندوب التوصيل');
    },
    onError: (err: any) => toastError('تعذر تحديد الجاهزية', err?.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason, notes }: any) =>
      api.post(`/api/orders/${id}/reject-pending`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
      setRejectTargetId(null);
      setRejectNotes('');
      success('تم رفض الطلب وتوثيق السبب');
    },
    onError: (err: any) => toastError('فشل رفض الطلب', err?.message),
  });

  const pendingOrders = boardOrders.filter((o) => o.status === OrderStatus.PENDING);
  const acceptedOrders = boardOrders.filter((o) => o.status === OrderStatus.ACCEPTED);
  const inPrepOrders = boardOrders.filter((o) => o.status === OrderStatus.IN_PREPARATION);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ChefHat className="h-7 w-7 text-emerald-600" />
              شاشة المطبخ والتحضير الفورية (KDS)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              فرع: <span className="font-bold text-slate-800">{user?.branch?.name || 'الفرع'}</span>{' '}
              • شاشة مخصصة للشاشات اللمسية وتحديث فوري لحالات الطلبات
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100">
              <span
                className={`h-2.5 w-2.5 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
              />
              {socketStatus === 'connected' ? 'تحديث حي مباشر' : 'جاري إعادة الاتصال...'}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
              تحديث يدوي
            </Button>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lane 1: Pending Orders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500 text-white font-black text-sm shadow-xs">
                <span>طلبات جديدة بانتظار التأكيد</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                  {pendingOrders.length}
                </span>
              </div>

              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="border-2 border-amber-300 bg-white shadow-md">
                    <CardHeader className="p-4 pb-2 border-b border-amber-100 bg-amber-50/40">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                          <Clock className="h-4 w-4" />
                          {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Items List */}
                      <div className="divide-y divide-slate-100">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-900">{it.name}</span>
                            <span className="font-black text-base px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              × {it.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <p className="text-xs p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                          ملاحظات: {order.notes}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <Button
                          variant="destructive"
                          onClick={() => setRejectTargetId(order.id)}
                          className="h-11 font-bold text-xs"
                        >
                          <X className="me-1 h-4 w-4" />
                          رفض
                        </Button>
                        <Button
                          onClick={() => acceptMutation.mutate(order.id)}
                          loading={acceptMutation.isPending}
                          className="h-11 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="me-1 h-4 w-4" />
                          قبول الطلب
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pendingOrders.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-white border border-dashed border-slate-200 text-xs text-slate-400">
                    لا توجد طلبات جديدة بانتظار التأكيد
                  </div>
                )}
              </div>
            </div>

            {/* Lane 2: Accepted (Ready to Start Prep) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-600 text-white font-black text-sm shadow-xs">
                <span>تم قبولها (جاهزة للتحضير)</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                  {acceptedOrders.length}
                </span>
              </div>

              <div className="space-y-4">
                {acceptedOrders.map((order) => (
                  <Card key={order.id} className="border-2 border-blue-200 bg-white shadow-xs">
                    <CardHeader className="p-4 pb-2 border-b border-blue-50 bg-blue-50/30">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTime(order.createdAt)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="divide-y divide-slate-100">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-900">{it.name}</span>
                            <span className="font-black text-base px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              × {it.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={() => startPrepMutation.mutate(order.id)}
                        loading={startPrepMutation.isPending}
                        className="w-full h-11 font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Play className="me-2 h-4 w-4" />
                        بدء التحضير بالمطبخ
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {acceptedOrders.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-white border border-dashed border-slate-200 text-xs text-slate-400">
                    لا توجد طلبات في هذا الطابور
                  </div>
                )}
              </div>
            </div>

            {/* Lane 3: In Preparation (Cooking) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-600 text-white font-black text-sm shadow-xs">
                <span>جاري الطهي والتحضير</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                  {inPrepOrders.length}
                </span>
              </div>

              <div className="space-y-4">
                {inPrepOrders.map((order) => (
                  <Card key={order.id} className="border-2 border-purple-300 bg-white shadow-md">
                    <CardHeader className="p-4 pb-2 border-b border-purple-100 bg-purple-50/40">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 animate-pulse">
                          <ChefHat className="h-4 w-4" />
                          قيد الطهي
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="divide-y divide-slate-100">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-900">{it.name}</span>
                            <span className="font-black text-base px-2 py-0.5 rounded bg-purple-50 text-purple-900">
                              × {it.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={() => markReadyMutation.mutate(order.id)}
                        loading={markReadyMutation.isPending}
                        className="w-full h-12 font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      >
                        <CheckCircle2 className="me-2 h-5 w-5" />
                        جاهز للتسليم لمندوب التوصيل
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {inPrepOrders.length === 0 && (
                  <div className="p-8 text-center rounded-xl bg-white border border-dashed border-slate-200 text-xs text-slate-400">
                    لا توجد أطباق قيد الطهي حالياً
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        <Dialog
          open={Boolean(rejectTargetId)}
          onOpenChange={(open) => !open && setRejectTargetId(null)}
          title="رفض الطلب المعلق"
          description="يرجى توضيح سبب رفض الطلب لإشعار العميل وتسجيله أمنياً"
        >
          <div className="space-y-4">
            <Select
              label="نوع سبب الإلغاء"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as OrderCancellationReason)}
              options={[
                {
                  label: 'رفض من المطبخ (Kitchen Reject)',
                  value: OrderCancellationReason.KITCHEN_REJECT,
                },
                { label: 'طلب العميل الإلغاء (Customer)', value: OrderCancellationReason.CUSTOMER },
                { label: 'إلغاء إداري (Admin)', value: OrderCancellationReason.ADMIN },
              ]}
            />

            <Input
              label="توضيح السبب بالتفصيل"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="مثال: نفاد مكونات الوجبة، تعطل الفرن..."
              required
            />

            <Button
              variant="destructive"
              className="w-full h-11 font-bold"
              loading={rejectMutation.isPending}
              onClick={() => {
                if (rejectTargetId) {
                  rejectMutation.mutate({
                    id: rejectTargetId,
                    reason: rejectReason,
                    notes: rejectNotes.trim() || undefined,
                  });
                }
              }}
            >
              تأكيد رفض الطلب
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
