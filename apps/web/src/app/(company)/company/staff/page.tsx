'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
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
import { Role } from '@chatpilot/contracts';
import { ColumnDef } from '@tanstack/react-table';
import { UserPlus, UserX, UserCog, Copy, Check } from 'lucide-react';

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export default function CompanyStaffPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [roleTarget, setRoleTarget] = React.useState<StaffRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<StaffRow | null>(null);
  const [invitationLinkData, setInvitationLinkData] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Invite Form State
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Role>(Role.STAFF);
  const [branchId, setBranchId] = React.useState('');

  // Role Change State
  const [newRole, setNewRole] = React.useState<Role>(Role.STAFF);

  const { data: staff = [], isLoading } = useQuery<StaffRow[]>({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffRow[]>('/api/staff'),
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<any[]>('/api/branches'),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/staff/invite', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setInviteOpen(false);
      setEmail('');
      if (res?.token) {
        setInvitationLinkData(res.token);
      }
      success('تم إرسال دعوة الانضمام للموظف بنجاح');
    },
    onError: (err: any) => toastError('فشل إرسال الدعوة', err?.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDeactivateTarget(null);
      success('تم إلغاء تفعيل حساب الموظف');
    },
    onError: (err: any) => toastError('تعذر إلغاء التفعيل', err?.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api.patch(`/api/staff/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setRoleTarget(null);
      success('تم تحديث دور وصلاحيات الموظف');
    },
    onError: (err: any) => toastError('فشل تعديل الدور', err?.message),
  });

  const columns: ColumnDef<StaffRow>[] = [
    {
      accessorKey: 'name',
      header: 'اسم الموظف',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.original.name}</span>
          <span className="text-xs text-slate-400 font-mono">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'الدور والصلاحيات',
      cell: ({ row }) => <StatusBadge status={row.original.role} />,
    },
    {
      accessorKey: 'branch',
      header: 'الفرع المعين',
      cell: ({ row }) => {
        const b = row.original.branch;
        if (!b) return <span className="text-xs text-slate-400">إدارة الشركة (كل الفروع)</span>;
        return (
          <span className="text-xs font-semibold text-slate-700">
            {b.name} ({b.code})
          </span>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            row.original.isActive
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.original.isActive ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'تاريخ الانضمام',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const s = row.original;
        const isSelf = s.id === currentUser?.id;

        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isSelf}
              onClick={() => {
                setRoleTarget(s);
                setNewRole(s.role);
              }}
              className="h-8 text-xs"
            >
              <UserCog className="h-3.5 w-3.5 me-1 text-slate-500" />
              تغيير الدور
            </Button>
            {s.isActive && !isSelf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeactivateTarget(s)}
                className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <UserX className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const fullInviteUrl = invitationLinkData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invitations/${invitationLinkData}`
    : '';

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            طاقم العمل والموظفون
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة موظفي الشركة والفروع، تعيين الأدوار والصلاحيات، وإرسال دعوات الانضمام
          </p>
        </div>

        <DataTable
          columns={columns}
          data={staff}
          loading={isLoading}
          searchPlaceholder="بحث باسم الموظف أو البريد..."
          emptyTitle="لا يوجد موظفون مسجلون"
          headerAction={
            <Button onClick={() => setInviteOpen(true)} className="h-9 font-semibold text-xs">
              <UserPlus className="me-1.5 h-4 w-4" />
              دعوة موظف جديد
            </Button>
          }
        />

        {/* Invite Staff Dialog */}
        <FormDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title="دعوة موظف جديد للانضمام"
          description="أدخل البريد الإلكتروني وحدد الدور والفرع لإرسال رابط التفعيل"
          submitLabel="إرسال الدعوة"
          loading={inviteMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate({
              email: email.trim(),
              role,
              branchId: branchId || undefined,
            });
          }}
        >
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@restaurant.eg"
            required
          />

          <Select
            label="الدور الوظيفي"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={[
              { label: 'مدير شركة (Company Admin)', value: Role.COMPANY_ADMIN },
              { label: 'مدير فرع (Branch Manager)', value: Role.BRANCH_MANAGER },
              { label: 'طاقم المطبخ (Kitchen)', value: Role.KITCHEN },
              { label: 'مندوب توصيل (Delivery)', value: Role.DELIVERY },
              { label: 'استقبال وتأكيد طلبات (Staff)', value: Role.STAFF },
            ]}
          />

          {String(role) !== Role.COMPANY_ADMIN && (
            <Select
              label="الفرع المعين (إلزامي لأدوار الفروع)"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={[
                { label: 'اختر الفرع...', value: '' },
                ...branches.map((b: any) => ({ label: `${b.name} (${b.code})`, value: b.id })),
              ]}
              required={String(role) !== Role.COMPANY_ADMIN}
            />
          )}
        </FormDialog>

        {/* Change Role Dialog */}
        <FormDialog
          open={Boolean(roleTarget)}
          onOpenChange={(open) => !open && setRoleTarget(null)}
          title={`تعديل دور: ${roleTarget?.name || ''}`}
          submitLabel="تحديث الصلاحيات"
          loading={changeRoleMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            if (roleTarget) {
              changeRoleMutation.mutate({ id: roleTarget.id, role: newRole });
            }
          }}
        >
          <Select
            label="الدور الوظيفي الجديد"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            options={[
              { label: 'مدير شركة (Company Admin)', value: Role.COMPANY_ADMIN },
              { label: 'مدير فرع (Branch Manager)', value: Role.BRANCH_MANAGER },
              { label: 'طاقم المطبخ (Kitchen)', value: Role.KITCHEN },
              { label: 'مندوب توصيل (Delivery)', value: Role.DELIVERY },
              { label: 'استقبال وتأكيد طلبات (Staff)', value: Role.STAFF },
            ]}
          />
        </FormDialog>

        {/* Deactivate Confirm Dialog */}
        <ConfirmDialog
          open={Boolean(deactivateTarget)}
          onOpenChange={(open) => !open && setDeactivateTarget(null)}
          title={`إلغاء تفعيل حساب ${deactivateTarget?.name || ''}`}
          message="سيتم إيقاف حساب الموظف فوراً وإلغاء جميع جلسات الدخول الخاصة به. لا يمكن إلغاء تفعيل آخر مدير نشط للشركة."
          confirmLabel="إلغاء التفعيل"
          loading={deactivateMutation.isPending}
          onConfirm={async () => {
            if (deactivateTarget) {
              await deactivateMutation.mutateAsync(deactivateTarget.id);
            }
          }}
        />

        {/* Generated Invitation Link Modal */}
        <Dialog
          open={Boolean(invitationLinkData)}
          onOpenChange={(open) => !open && setInvitationLinkData(null)}
          title="تم إنشاء دعوة الموظف بنجاح"
          description="يمكنك نسخ هذا الرابط وإرساله للموظف مباشرة لتفعيل حسابه وتعيين كلمة المرور"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-800 block mb-1">
                رابط التفعيل المباشر:
              </span>
              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border text-xs font-mono text-slate-800 break-all select-all">
                <span>{fullInviteUrl}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(fullInviteUrl);
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

            <Button className="w-full" onClick={() => setInvitationLinkData(null)}>
              إغلاق
            </Button>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
