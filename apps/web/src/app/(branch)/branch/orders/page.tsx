'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { Dialog } from '../../../../components/ui/dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useToast } from '../../../../components/ui/toast';
import { formatCurrency, formatDateTime } from '../../../../lib/utils';
import {
  OrderStatus,
  OrderResponseDto,
  OrderCancellationReason,
  DeliveryFailureReason,
} from '@chatpilot/contracts';
import { ColumnDef } from '@tanstack/react-table';
import { Eye, Ban, AlertTriangle, Phone, MapPin } from 'lucide-react';

export default function BranchOrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [selectedStatus, setSelectedStatus] = React.useState<string>('');
  const [viewOrderId, setViewOrderId] = React.useState<string | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = React.useState<OrderResponseDto | null>(null);
  const [failDeliveryOrder, setFailDeliveryOrder] = React.useState<OrderResponseDto | null>(null);
  const [failureReason, setFailureReason] = React.useState<DeliveryFailureReason>(
    DeliveryFailureReason.CUSTOMER_UNREACHABLE,
  );

  const { data: orders = [], isLoading } = useQuery<OrderResponseDto[]>({
    queryKey: ['orders', 'branch', branchId, selectedStatus],
    queryFn: () =>
      api.get<OrderResponseDto[]>('/api/orders', {
        params: {
          branchId: branchId || undefined,
          status: selectedStatus || undefined,
        },
      }),
    enabled: Boolean(branchId),
  });

  const { data: orderDetail } = useQuery<OrderResponseDto>({
    queryKey: ['orders', viewOrderId],
    queryFn: () => api.get<OrderResponseDto>(`/api/orders/${viewOrderId}`),
    enabled: Boolean(viewOrderId),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/orders/${id}/cancel`, {
        reason: OrderCancellationReason.ADMIN,
        notes: reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelTargetOrder(null);
      success('تم إلغاء الطلب بنجاح وتوثيق سبب الإلغاء');
    },
    onError: (err: any) => toastError('فشل إلغاء الطلب', err?.message),
  });

  const failDeliveryMutation = useMutation({
    mutationFn: ({
      id,
      reason,
      notes,
    }: {
      id: string;
      reason: DeliveryFailureReason;
      notes?: string;
    }) => api.post(`/api/orders/${id}/report-failure`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setFailDeliveryOrder(null);
      success('تم تسجيل تعذر التوصيل');
    },
    onError: (err: any) => toastError('فشل تسجيل التقرير', err?.message),
  });

  const columns: ColumnDef<OrderResponseDto>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'رقم الطلب',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-900">#{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'phone',
      header: 'العميل',
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">{row.original.phone}</span>
          <span className="text-[11px] text-slate-400 truncate max-w-[140px] block">
            {row.original.address || 'استلام من المطعم'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'total',
      header: 'الإجمالي',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900">
          {formatCurrency(row.original.total, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'التوقيت',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات الإدارية',
      cell: ({ row }) => {
        const o = row.original;
        const isTerminal =
          o.status === OrderStatus.DELIVERED ||
          o.status === OrderStatus.CANCELLED ||
          o.status === OrderStatus.FAILED_DELIVERY;

        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewOrderId(o.id)}
              className="h-8 text-xs"
            >
              <Eye className="me-1 h-3.5 w-3.5 text-blue-600" />
              تفاصيل
            </Button>

            {!isTerminal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelTargetOrder(o)}
                className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Ban className="me-1 h-3.5 w-3.5" />
                إلغاء إداري
              </Button>
            )}

            {o.status === OrderStatus.OUT_FOR_DELIVERY && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFailDeliveryOrder(o)}
                className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
              >
                <AlertTriangle className="me-1 h-3.5 w-3.5" />
                تعذر التوصيل
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            إدارة ومتابعة طلبات الفرع
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مراقبة سير العمليات التشغيلية، الإلغاءات الإدارية، وإبلاغ تعذر التوصيل (ملاحظة: إجراءات
            المطبخ والتوصيل التشغيلية محجوبة إدارياً)
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="w-56">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: 'جميع الحالات', value: '' },
                { label: 'قيد المراجعة (Pending)', value: OrderStatus.PENDING },
                { label: 'تم القبول (Accepted)', value: OrderStatus.ACCEPTED },
                { label: 'قيد التحضير (In Prep)', value: OrderStatus.IN_PREPARATION },
                { label: 'جاهز للتوصيل (Ready)', value: OrderStatus.READY_FOR_DELIVERY },
                { label: 'في الطريق (Out)', value: OrderStatus.OUT_FOR_DELIVERY },
                { label: 'تم التوصيل (Delivered)', value: OrderStatus.DELIVERED },
                { label: 'ملغي (Cancelled)', value: OrderStatus.CANCELLED },
                { label: 'فشل التوصيل (Failed)', value: OrderStatus.FAILED_DELIVERY },
              ]}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          searchPlaceholder="بحث برقم الطلب أو الهاتف..."
          emptyTitle="لا توجد طلبات مسجلة بالفرع"
        />

        {/* Order Details Dialog */}
        <Dialog
          open={Boolean(viewOrderId)}
          onOpenChange={(open) => !open && setViewOrderId(null)}
          title={`تفاصيل الطلب #${orderDetail?.orderNumber || ''}`}
        >
          {orderDetail && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border">
                <div>
                  <span className="text-slate-400 block">الحالة الحالية:</span>
                  <StatusBadge status={orderDetail.status} className="mt-1" />
                </div>
                <div className="text-end">
                  <span className="text-slate-400 block">الإجمالي النهائي:</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {formatCurrency(orderDetail.total, orderDetail.currency)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border space-y-1.5">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold">{orderDetail.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{orderDetail.address || 'استلام من المطعم'}</span>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-800 mb-2">الأصناف المطلوبة:</p>
                <div className="divide-y divide-slate-100 rounded-xl border bg-white">
                  {(orderDetail.items || []).map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{item.nameSnapshot}</span>
                        <span className="ms-2 text-slate-500 font-semibold">× {item.quantity}</span>
                      </div>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(item.lineTotal, orderDetail.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Dialog>

        {/* Admin Cancel Dialog */}
        <ConfirmDialog
          open={Boolean(cancelTargetOrder)}
          onOpenChange={(open) => !open && setCancelTargetOrder(null)}
          title={`إلغاء الطلب #${cancelTargetOrder?.orderNumber || ''}`}
          message="سيتم إلغاء الطلب فوراً وتسجيل السبب في سجل تدقيق الطلب."
          confirmLabel="تأكيد الإلغاء"
          requireReason
          reasonLabel="سبب الإلغاء"
          reasonPlaceholder="تعديل طلب، تأخر الفرع، بناءً على اتصال العميل..."
          loading={cancelMutation.isPending}
          onConfirm={async (reason) => {
            if (cancelTargetOrder && reason) {
              await cancelMutation.mutateAsync({ id: cancelTargetOrder.id, reason });
            }
          }}
        />

        {/* Report Delivery Failure Dialog */}
        <Dialog
          open={Boolean(failDeliveryOrder)}
          onOpenChange={(open) => !open && setFailDeliveryOrder(null)}
          title={`إبلاغ عن تعذر توصيل الطلب #${failDeliveryOrder?.orderNumber || ''}`}
        >
          <div className="space-y-4">
            <Select
              label="سبب تعذر التوصيل"
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value as DeliveryFailureReason)}
              options={[
                {
                  label: 'العميل لا يجيب على الهاتف (Customer Unreachable)',
                  value: DeliveryFailureReason.CUSTOMER_UNREACHABLE,
                },
                {
                  label: 'مشكلة في العنوان (Address Problem)',
                  value: DeliveryFailureReason.ADDRESS_PROBLEM,
                },
                {
                  label: 'حادث أو عطل أثناء التوصيل (Accident)',
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
              className="w-full h-10 font-bold"
              loading={failDeliveryMutation.isPending}
              onClick={() => {
                if (failDeliveryOrder) {
                  failDeliveryMutation.mutate({
                    id: failDeliveryOrder.id,
                    reason: failureReason,
                  });
                }
              }}
            >
              تسجيل فشل التوصيل
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
