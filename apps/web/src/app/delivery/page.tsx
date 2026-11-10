'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { useAuth } from '../../providers/auth-provider';
import { useSocket } from '../../providers/socket-provider';
import { AppShell } from '../../components/layout/app-shell';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/dialog';
import { TableSkeleton } from '../../components/ui/loading-skeleton';
import { useToast } from '../../components/ui/toast';
import { formatCurrency, formatTime } from '../../lib/utils';
import { DeliveryBoardOrderDto, OrderStatus, DeliveryFailureReason } from '@chatpilot/contracts';
import { Bike, CheckCircle2, AlertTriangle, Phone, MapPin, Navigation, Clock } from 'lucide-react';

export default function DeliveryBoardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { status: socketStatus } = useSocket();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [failTargetId, setFailTargetId] = React.useState<string | null>(null);
  const [failReason, setFailReason] = React.useState<DeliveryFailureReason>(
    DeliveryFailureReason.CUSTOMER_UNREACHABLE,
  );

  const {
    data: boardOrders = [],
    isLoading,
    refetch,
  } = useQuery<DeliveryBoardOrderDto[]>({
    queryKey: ['delivery', 'board', branchId],
    queryFn: () =>
      api.get<DeliveryBoardOrderDto[]>(`/api/orders/delivery/board?branchId=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 10000,
  });

  const startDeliveryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/start-delivery`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'board'] });
      success('بدأت رحلة التوصيل مع المندوب');
    },
    onError: (err: any) => toastError('تعذر بدء التوصيل', err?.message),
  });

  const markDeliveredMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/orders/${id}/mark-delivered`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'board'] });
      success('تم تسليم الطلب للعميل بنجاح');
    },
    onError: (err: any) => toastError('تعذر تأكيد التسليم', err?.message),
  });

  const reportFailureMutation = useMutation({
    mutationFn: ({ id, reason }: any) => api.post(`/api/orders/${id}/report-failure`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'board'] });
      setFailTargetId(null);
      success('تم تسجيل تعذر التسليم للطلب');
    },
    onError: (err: any) => toastError('فشل تسجيل التقرير', err?.message),
  });

  const readyOrders = boardOrders.filter((o) => o.status === OrderStatus.READY_FOR_DELIVERY);
  const outOrders = boardOrders.filter((o) => o.status === OrderStatus.OUT_FOR_DELIVERY);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Bike className="h-7 w-7 text-emerald-600" />
              شاشة حركة التوصيل والمناديب الميدانية
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              فرع: <span className="font-bold text-slate-800">{user?.branch?.name || 'الفرع'}</span>{' '}
              • شاشة مخصصة لمناديب التوصيل ومنسق الحركة
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
              تحديث
            </Button>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lane 1: Ready for Delivery */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-xs">
                <span>طلبات جاهزة للاستلام من المطعم</span>
                <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono">
                  {readyOrders.length}
                </span>
              </div>

              <div className="space-y-4">
                {readyOrders.map((order) => (
                  <Card key={order.id} className="border-2 border-emerald-300 bg-white shadow-md">
                    <CardHeader className="p-4 pb-2 border-b border-emerald-100 bg-emerald-50/30">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-sm font-black text-emerald-700">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${order.phone}`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            {order.phone}
                          </a>
                        </div>
                        <div className="flex items-start gap-2 text-slate-700">
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="font-medium">
                            {order.address || 'استلام مباشر من المطعم'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 pt-1 border-t">
                          <Clock className="h-3.5 w-3.5" />
                          <span>جاهز منذ: {formatTime(order.createdAt)}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => startDeliveryMutation.mutate(order.id)}
                        loading={startDeliveryMutation.isPending}
                        className="w-full h-12 font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      >
                        <Navigation className="me-2 h-5 w-5" />
                        استلام والخروج للتوصيل
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {readyOrders.length === 0 && (
                  <div className="p-12 text-center rounded-xl bg-white border border-dashed border-slate-300 text-xs text-slate-400">
                    لا توجد طلبات جاهزة بانتظار استلام المناديب حالياً.
                  </div>
                )}
              </div>
            </div>

            {/* Lane 2: Out for Delivery */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-600 text-white font-black text-sm shadow-xs">
                <span>طلبات في الطريق للعملاء</span>
                <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono">
                  {outOrders.length}
                </span>
              </div>

              <div className="space-y-4">
                {outOrders.map((order) => (
                  <Card key={order.id} className="border-2 border-blue-300 bg-white shadow-md">
                    <CardHeader className="p-4 pb-2 border-b border-blue-100 bg-blue-50/30">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${order.phone}`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            {order.phone}
                          </a>
                        </div>
                        <div className="flex items-start gap-2 text-slate-700">
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="font-medium">{order.address}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setFailTargetId(order.id)}
                          className="h-11 font-bold text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                        >
                          <AlertTriangle className="me-1 h-4 w-4" />
                          تعذر التسليم
                        </Button>
                        <Button
                          onClick={() => markDeliveredMutation.mutate(order.id)}
                          loading={markDeliveredMutation.isPending}
                          className="h-11 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="me-1 h-4 w-4" />
                          تم التسليم
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {outOrders.length === 0 && (
                  <div className="p-12 text-center rounded-xl bg-white border border-dashed border-slate-300 text-xs text-slate-400">
                    لا توجد طلبات جارية في مسار التوصيل الآن.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report Delivery Failure Dialog */}
        <Dialog
          open={Boolean(failTargetId)}
          onOpenChange={(open) => !open && setFailTargetId(null)}
          title="تسجيل تعذر تسليم الطلب"
          description="يرجى توضيح سبب تعذر التسليم لإبلاغ المطعم والعميل"
        >
          <div className="space-y-4">
            <Select
              label="سبب تعذر التسليم"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value as DeliveryFailureReason)}
              options={[
                {
                  label: 'العميل لا يجيب على الهاتف (Customer Unreachable)',
                  value: DeliveryFailureReason.CUSTOMER_UNREACHABLE,
                },
                {
                  label: 'مشكلة في العنوان أو غير واضح (Address Problem)',
                  value: DeliveryFailureReason.ADDRESS_PROBLEM,
                },
                {
                  label: 'عطل في وسيلة النقل / حادث (Accident)',
                  value: DeliveryFailureReason.ACCIDENT,
                },
                {
                  label: 'فقدان أو نقص في الأصناف (Item Missing)',
                  value: DeliveryFailureReason.ITEM_MISSING,
                },
                { label: 'سبب تشغيلي آخر (Other)', value: DeliveryFailureReason.OTHER },
              ]}
            />

            <Button
              variant="destructive"
              className="w-full h-11 font-bold"
              loading={reportFailureMutation.isPending}
              onClick={() => {
                if (failTargetId) {
                  reportFailureMutation.mutate({
                    id: failTargetId,
                    reason: failReason,
                  });
                }
              }}
            >
              تأكيد تسجيل تعذر التسليم
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
