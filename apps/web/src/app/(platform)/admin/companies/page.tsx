'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { Dialog } from '../../../../components/ui/dialog';
import { useToast } from '../../../../components/ui/toast';
import { formatDate } from '../../../../lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, CheckCircle, Ban, Eye, Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  branchCount: number;
  userCount: number;
  orderCount: number;
  createdAt: string;
}

export default function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [suspendTarget, setSuspendTarget] = React.useState<CompanyRow | null>(null);
  const [invitationModalData, setInvitationModalData] = React.useState<{
    slug: string;
    token: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [currency, setCurrency] = React.useState('EGP');
  const [countryCode, setCountryCode] = React.useState('EG');
  const [timezone, setTimezone] = React.useState('Africa/Cairo');

  // Query companies list
  const { data: companies = [], isLoading } = useQuery<CompanyRow[]>({
    queryKey: ['platform', 'companies'],
    queryFn: () => api.get<CompanyRow[]>('/api/platform/companies'),
  });

  // Create Company Mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<any>('/api/companies', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'companies'] });
      setCreateOpen(false);
      setName('');
      setSlug('');
      setAdminEmail('');
      setInvitationModalData({ slug: res.slug, token: res.adminInvitationToken });
      success('تم إنشاء الشركة بنجاح', 'تم توليد رابط دعوة المسؤول الأول للشركة');
    },
    onError: (err: any) => {
      toastError('فشل إنشاء الشركة', err?.message);
    },
  });

  // Suspend Company Mutation
  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/companies/${id}/suspend`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'companies'] });
      success('تم تعليق حساب الشركة', 'تم إلغاء جميع الجلسات النشطة لمستخدمي الشركة');
    },
    onError: (err: any) => {
      toastError('فشل تعليق الشركة', err?.message);
    },
  });

  // Activate Company Mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/companies/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'companies'] });
      success('تم تفعيل الشركة بنجاح');
    },
    onError: (err: any) => {
      toastError('فشل تفعيل الشركة', err?.message);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      adminEmail: adminEmail.trim(),
      defaultCurrency: currency,
      countryCode,
      defaultTimezone: timezone,
    });
  };

  const columns: ColumnDef<CompanyRow>[] = [
    {
      accessorKey: 'name',
      header: 'اسم المطعم / الشركة',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.original.name}</span>
          <span className="text-xs text-slate-400 font-mono">@{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'branchCount',
      header: 'الفروع',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-700">{row.original.branchCount} فروع</span>
      ),
    },
    {
      accessorKey: 'userCount',
      header: 'المستخدمون',
      cell: ({ row }) => <span className="text-slate-600">{row.original.userCount} موظف</span>,
    },
    {
      accessorKey: 'orderCount',
      header: 'الطلبات',
      cell: ({ row }) => (
        <span className="text-slate-600 font-semibold">{row.original.orderCount} طلب</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'تاريخ التسجيل',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/companies/${c.id}`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Eye className="me-1 h-3.5 w-3.5 text-blue-600" />
                تدقيق
              </Button>
            </Link>

            {c.status === 'ACTIVE' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuspendTarget(c)}
                className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Ban className="me-1 h-3.5 w-3.5" />
                تعليق
              </Button>
            ) : c.status === 'SUSPENDED' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => activateMutation.mutate(c.id)}
                className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <CheckCircle className="me-1 h-3.5 w-3.5" />
                تفعيل
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const fullInvitationLink = invitationModalData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invitations/${invitationModalData.token}`
    : '';

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            إدارة الشركات والمطاعم
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل شركات مطاعم جديدة، مراقبة نشاط المستأجرين، التحكم في التفعيل والتعليق، والتفتيش
            المدقق
          </p>
        </div>

        <DataTable
          columns={columns}
          data={companies}
          loading={isLoading}
          searchPlaceholder="بحث باسم الشركة أو الرمز..."
          emptyTitle="لا توجد شركات مسجلة"
          emptyDescription="قم بإضافة أول شركة مطاعم لبدء استخدام المنصة."
          headerAction={
            <Button onClick={() => setCreateOpen(true)} className="h-9 font-semibold text-xs">
              <Plus className="me-1.5 h-4 w-4" />
              إضافة شركة جديدة
            </Button>
          }
        />

        {/* Create Company Modal */}
        <FormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="تسجيل شركة مطاعم جديدة"
          description="إنشاء حساب مستأجر جديد وتوليد رابط دعوة المسؤول الأول (Company Admin)"
          submitLabel="إنشاء الشركة والدعوة"
          loading={createMutation.isPending}
          onSubmit={handleCreateSubmit}
        >
          <Input
            label="اسم المطعم / الشركة"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
            }}
            placeholder="مثال: قصر الكبابجي"
            required
          />

          <Input
            label="رمز المعرّف (Slug)"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="kababgy-cairo"
            required
          />

          <Input
            label="البريد الإلكتروني للمسؤول الأول"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@kababgy.eg"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="العملة الافتراضية"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[
                { label: 'جنيه مصري (EGP)', value: 'EGP' },
                { label: 'دولار أمريكي (USD)', value: 'USD' },
                { label: 'ريال سعودي (SAR)', value: 'SAR' },
                { label: 'درهم إماراتي (AED)', value: 'AED' },
              ]}
            />
            <Select
              label="المنطقة الزمنية"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={[
                { label: 'القاهرة (Africa/Cairo)', value: 'Africa/Cairo' },
                { label: 'الرياض (Asia/Riyadh)', value: 'Asia/Riyadh' },
                { label: 'دبي (Asia/Dubai)', value: 'Asia/Dubai' },
              ]}
            />
          </div>
        </FormDialog>

        {/* Suspend Confirmation Dialog */}
        <ConfirmDialog
          open={Boolean(suspendTarget)}
          onOpenChange={(open) => !open && setSuspendTarget(null)}
          title={`تعليق حساب ${suspendTarget?.name || ''}`}
          message="سيؤدي تعليق الشركة إلى إلغاء جميع جلسات تسجيل الدخول النشطة لجميع موظفيها فوراً ومنع استقبال أي طلبات جديدة حتى إعادة التفعيل."
          confirmLabel="تأكيد التعليق"
          requireReason
          reasonLabel="سبب التعليق (مطلوب للتدقيق)"
          reasonPlaceholder="مثال: عدم سداد الاشتراك الشهري، مخالفة شروط الاستخدام..."
          loading={suspendMutation.isPending}
          onConfirm={async (reason) => {
            if (suspendTarget && reason) {
              await suspendMutation.mutateAsync({ id: suspendTarget.id, reason });
            }
          }}
        />

        {/* Invitation Link Presentation Modal */}
        <Dialog
          open={Boolean(invitationModalData)}
          onOpenChange={(open) => !open && setInvitationModalData(null)}
          title="تم إنشاء الشركة ورابط الدعوة بنجاح"
          description="شارك هذا الرابط لمرة واحدة مع مدير الشركة لتفعيل حسابه وتعيين كلمة المرور"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-800 block mb-1">
                رابط تفعيل المسؤول الأول:
              </span>
              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border text-xs font-mono text-slate-800 break-all select-all">
                <span>{fullInvitationLink}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(fullInvitationLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="h-8 shrink-0 text-xs"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button className="w-full mt-4" onClick={() => setInvitationModalData(null)}>
              تم النسخ وإغلاق
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
