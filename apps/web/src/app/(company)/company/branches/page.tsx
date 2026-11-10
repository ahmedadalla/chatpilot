'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useToast } from '../../../../components/ui/toast';
import { formatCurrency } from '../../../../lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Settings, Clock, Trash2 } from 'lucide-react';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  deliveryFee: number;
  minOrder: number;
  operatingHours: any;
  createdAt: string;
}

export default function CompanyBranchesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<BranchRow | null>(null);
  const [timezoneTarget, setTimezoneTarget] = React.useState<BranchRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<BranchRow | null>(null);

  // Form states
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [deliveryFee, setDeliveryFee] = React.useState(20);
  const [minOrder, setMinOrder] = React.useState(50);
  const [timezone, setTimezone] = React.useState('Africa/Cairo');

  // Timezone Audit Correction State
  const [newTimezone, setNewTimezone] = React.useState('Africa/Cairo');
  const [timezoneAuditReason, setTimezoneAuditReason] = React.useState('');

  const { data: branches = [], isLoading } = useQuery<BranchRow[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchRow[]>('/api/branches'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setCreateOpen(false);
      setCode('');
      setName('');
      setAddress('');
      success('تم إضافة الفرع بنجاح');
    },
    onError: (err: any) => toastError('فشل إضافة الفرع', err?.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/branches/${id}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setEditTarget(null);
      success('تم تحديث الإعدادات التشغيلية للفرع');
    },
    onError: (err: any) => toastError('فشل التحديث', err?.message),
  });

  const updateTimezoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/branches/${id}/timezone`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setTimezoneTarget(null);
      setTimezoneAuditReason('');
      success('تم تصحيح المنطقة الزمنية وتوثيق سبب التدقيق');
    },
    onError: (err: any) => toastError('فشل تعديل المنطقة الزمنية', err?.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      success('تم إلغاء تفعيل الفرع');
    },
    onError: (err: any) => toastError('فشل إلغاء التفعيل', err?.message),
  });

  const columns: ColumnDef<BranchRow>[] = [
    {
      accessorKey: 'code',
      header: 'رمز الفرع',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-900">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'اسم الفرع',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.original.name}</span>
          <span className="text-xs text-slate-400">
            {row.original.address || 'لا يوجد عنوان محدد'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'timezone',
      header: 'المنطقة الزمنية',
      cell: ({ row }) => (
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {row.original.timezone}
        </span>
      ),
    },
    {
      accessorKey: 'deliveryFee',
      header: 'رسوم التوصيل',
      cell: ({ row }) => <span>{formatCurrency(row.original.deliveryFee, 'EGP')}</span>,
    },
    {
      accessorKey: 'minOrder',
      header: 'الحد الأدنى للطلب',
      cell: ({ row }) => <span>{formatCurrency(row.original.minOrder, 'EGP')}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.original.isActive
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.original.isActive ? 'مفتوح للتشغيل' : 'مغلق'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditTarget(b);
                setName(b.name);
                setAddress(b.address || '');
                setDeliveryFee(b.deliveryFee);
                setMinOrder(b.minOrder);
              }}
              className="h-8 text-xs"
            >
              <Settings className="me-1 h-3.5 w-3.5 text-slate-500" />
              الإعدادات
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTimezoneTarget(b);
                setNewTimezone(b.timezone);
              }}
              className="h-8 text-xs text-amber-600 border-amber-200"
            >
              <Clock className="me-1 h-3.5 w-3.5" />
              المنطقة الزمنية
            </Button>
            {b.isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeactivateTarget(b)}
                className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">إدارة فروع الشركة</h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الفروع، أوقات العمل، رسوم التوصيل والحد الأدنى للطلبات، وتصحيح المناطق الزمنية
          </p>
        </div>

        <DataTable
          columns={columns}
          data={branches}
          loading={isLoading}
          searchPlaceholder="بحث برمز الفرع أو الاسم..."
          emptyTitle="لا توجد فروع مسجلة"
          emptyDescription="قم بإضافة أول فرع للشركة لتفعيل استلام وتوصيل الطلبات."
          headerAction={
            <Button onClick={() => setCreateOpen(true)} className="h-9 font-semibold text-xs">
              <Plus className="me-1.5 h-4 w-4" />
              إضافة فرع جديد
            </Button>
          }
        />

        {/* Create Branch Modal */}
        <FormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="إضافة فرع مطعم جديد"
          submitLabel="إنشاء الفرع"
          loading={createMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              code: code.trim().toUpperCase(),
              name: name.trim(),
              address: address.trim() || undefined,
              deliveryFee: Number(deliveryFee),
              minOrder: Number(minOrder),
              timezone,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="رمز الفرع (Code)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CAI-01"
              required
            />
            <Input
              label="اسم الفرع"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="فرع المعادي"
              required
            />
          </div>

          <Input
            label="العنوان التفصيلي"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="شارع 9، المعادي، القاهرة"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="رسوم التوصيل (EGP)"
              type="number"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Number(e.target.value))}
              required
            />
            <Input
              label="الحد الأدنى للطلب (EGP)"
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(Number(e.target.value))}
              required
            />
          </div>

          <Select
            label="المنطقة الزمنية (IANA Timezone)"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={[
              { label: 'القاهرة (Africa/Cairo)', value: 'Africa/Cairo' },
              { label: 'الرياض (Asia/Riyadh)', value: 'Asia/Riyadh' },
              { label: 'دبي (Asia/Dubai)', value: 'Asia/Dubai' },
            ]}
          />
        </FormDialog>

        {/* Edit Settings Modal */}
        <FormDialog
          open={Boolean(editTarget)}
          onOpenChange={(open) => !open && setEditTarget(null)}
          title={`تعديل إعدادات ${editTarget?.name || ''}`}
          submitLabel="حفظ التعديلات"
          loading={updateSettingsMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            if (editTarget) {
              updateSettingsMutation.mutate({
                id: editTarget.id,
                data: {
                  name: name.trim(),
                  address: address.trim() || undefined,
                  deliveryFee: Number(deliveryFee),
                  minOrder: Number(minOrder),
                },
              });
            }
          }}
        >
          <Input
            label="اسم الفرع"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="رسوم التوصيل (EGP)"
              type="number"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Number(e.target.value))}
              required
            />
            <Input
              label="الحد الأدنى للطلب (EGP)"
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(Number(e.target.value))}
              required
            />
          </div>
        </FormDialog>

        {/* Timezone Correction Modal */}
        <FormDialog
          open={Boolean(timezoneTarget)}
          onOpenChange={(open) => !open && setTimezoneTarget(null)}
          title={`تعديل المنطقة الزمنية المدقق: ${timezoneTarget?.name || ''}`}
          description="تعديل المنطقة الزمنية يحفظ في سجل التدقيق الأمني ويحافظ على صحة تواريخ الطلبات السابقة (D-18)"
          submitLabel="تأكيد التعديل المدقق"
          loading={updateTimezoneMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            if (timezoneTarget) {
              updateTimezoneMutation.mutate({
                id: timezoneTarget.id,
                data: {
                  timezone: newTimezone,
                  reason: timezoneAuditReason,
                },
              });
            }
          }}
        >
          <Select
            label="المنطقة الزمنية الجديدة"
            value={newTimezone}
            onChange={(e) => setNewTimezone(e.target.value)}
            options={[
              { label: 'القاهرة (Africa/Cairo)', value: 'Africa/Cairo' },
              { label: 'الرياض (Asia/Riyadh)', value: 'Asia/Riyadh' },
              { label: 'دبي (Asia/Dubai)', value: 'Asia/Dubai' },
            ]}
          />
          <Input
            label="سبب التعديل (مطلوب للتدقيق)"
            value={timezoneAuditReason}
            onChange={(e) => setTimezoneAuditReason(e.target.value)}
            placeholder="مثال: تصحيح الخطأ الإداري عند إنشاء الفرع"
            required
          />
        </FormDialog>

        {/* Deactivate Confirm Dialog */}
        <ConfirmDialog
          open={Boolean(deactivateTarget)}
          onOpenChange={(open) => !open && setDeactivateTarget(null)}
          title={`إلغاء تفعيل فرع ${deactivateTarget?.name || ''}`}
          message="سيؤدي إلغاء تفعيل الفرع إلى منع استقبال أي طلبات جديدة عليه فوراً. هل أنت متأكد من الاستمرار؟"
          confirmLabel="إلغاء التفعيل"
          loading={deactivateMutation.isPending}
          onConfirm={async () => {
            if (deactivateTarget) {
              await deactivateMutation.mutateAsync(deactivateTarget.id);
            }
          }}
        />
      </div>
    </AppShell>
  );
}
