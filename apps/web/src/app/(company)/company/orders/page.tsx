'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { Dialog } from '../../../../components/ui/dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useToast } from '../../../../components/ui/toast';
import { formatCurrency, formatDateTime } from '../../../../lib/utils';
import { OrderStatus, OrderResponseDto, OrderCancellationReason } from '@chatpilot/contracts';
import { ColumnDef } from '@tanstack/react-table';
import { Eye, Ban, Clock, MapPin, Phone } from 'lucide-react';

export default function CompanyOrdersPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('');
  const [viewOrderId, setViewOrderId] = React.useState<string | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = React.useState<OrderResponseDto | null>(null);

  // Queries
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<any[]>('/api/branches'),
  });

  const { data: orders = [], isLoading } = useQuery<OrderResponseDto[]>({
    queryKey: ['orders', selectedBranchId, selectedStatus],
    queryFn: () =>
      api.get<OrderResponseDto[]>('/api/orders', {
        params: {
          branchId: selectedBranchId || undefined,
          status: selectedStatus || undefined,
        },
      }),
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
      success('تم إلغاء الطلب بنجاح وتحديث السجل');
    },
    onError: (err: any) => toastError('فشل إلغاء الطلب', err?.message),
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
            {row.original.address || 'استلام من الفرع'}
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
      header: 'تاريخ وتوقيت الطلب',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
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
                إلغاء
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">سجل طلبات الشركة</h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة شاملة لكافة الطلبات الواردة عبر الفروع، تفاصيل الأصناف، والخط الزمني للحالات
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="w-48">
            <Select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              options={[
                { label: 'جميع الفروع', value: '' },
                ...branches.map((b: any) => ({ label: `${b.name} (${b.code})`, value: b.id })),
              ]}
            />
          </div>

          <div className="w-48">
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
          emptyTitle="لا توجد طلبات مطابقة"
          emptyDescription="لم يتم العثور على أي طلبات في النطاق المحدد."
        />

        {/* Order Detail Modal */}
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

              {/* Customer Info */}
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

              {/* Items List */}
              <div>
                <p className="font-bold text-slate-800 mb-2">الأصناف المطلوبة:</p>
                <div className="divide-y divide-slate-100 rounded-xl border bg-white">
                  {(orderDetail.items || []).map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{item.nameSnapshot}</span>
                        <span className="ms-2 text-slate-500 font-semibold">× {item.quantity}</span>
                        {item.notes && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(item.lineTotal, orderDetail.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Timeline */}
              {Boolean(orderDetail.statusHistory && orderDetail.statusHistory.length > 0) && (
                <div>
                  <p className="font-bold text-slate-800 mb-2">سجل الحالات والتدقيق (Timeline):</p>
                  <div className="space-y-2">
                    {(orderDetail.statusHistory || []).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800">
                            {h.fromStatus} → {h.toStatus}
                          </span>
                          <span className="ms-2 text-slate-400">({h.actorRole})</span>
                          {h.reason && <p className="text-rose-600 mt-0.5">السبب: {h.reason}</p>}
                        </div>
                        <span className="text-slate-400 font-mono">
                          {formatDateTime(h.occurredAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Dialog>

        {/* Cancellation Confirmation */}
        <ConfirmDialog
          open={Boolean(cancelTargetOrder)}
          onOpenChange={(open) => !open && setCancelTargetOrder(null)}
          title={`إلغاء الطلب #${cancelTargetOrder?.orderNumber || ''}`}
          message="سيؤدي إلغاء الطلب إلى إيقاف تحضيره وتوصيله فوراً وإشعار العميل والفرع."
          confirmLabel="تأكيد إلغاء الطلب"
          requireReason
          reasonLabel="سبب الإلغاء الإداري"
          reasonPlaceholder="طلب العميل، نفاد الأصناف، ازدحام الفرع..."
          loading={cancelMutation.isPending}
          onConfirm={async (reason) => {
            if (cancelTargetOrder && reason) {
              await cancelMutation.mutateAsync({ id: cancelTargetOrder.id, reason });
            }
          }}
        />
      </div>
    </AppShell>
  );
}
