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
import { UserPlus, UserX, Copy, Check } from 'lucide-react';

export default function BranchStaffPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { success, error: toastError } = useToast();
  const branchId = currentUser?.branchId;

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [deactivateTarget, setDeactivateTarget] = React.useState<any | null>(null);
  const [invitationLinkData, setInvitationLinkData] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Role>(Role.KITCHEN);

  const { data: staff = [], isLoading } = useQuery<any[]>({
    queryKey: ['staff', 'branch', branchId],
    queryFn: () => api.get<any[]>('/api/staff', { params: { branchId: branchId || undefined } }),
    enabled: Boolean(branchId),
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
      success('تم إرسال دعوة انضمام لموظف الفرع');
    },
    onError: (err: any) => toastError('فشل إرسال الدعوة', err?.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDeactivateTarget(null);
      success('تم إلغاء تفعيل حساب الموظف بالفرع');
    },
    onError: (err: any) => toastError('فشل الإلغاء', err?.message),
  });

  const columns: ColumnDef<any>[] = [
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
      header: 'الدور بالفرع',
      cell: ({ row }) => <StatusBadge status={row.original.role} />,
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
        const canDeactivate =
          !isSelf && (s.role === Role.KITCHEN || s.role === Role.DELIVERY || s.role === Role.STAFF);

        return (
          canDeactivate &&
          s.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeactivateTarget(s)}
              className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <UserX className="me-1 h-3.5 w-3.5" />
              إلغاء التفعيل
            </Button>
          )
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">طاقم وموظفو الفرع</h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة موظفي الفرع الميدانيين (المطبخ، المناديب، والاستقبال) وإرسال دعوات الانضمام
          </p>
        </div>

        <DataTable
          columns={columns}
          data={staff}
          loading={isLoading}
          searchPlaceholder="بحث في موظفي الفرع..."
          emptyTitle="لا يوجد موظفون مسجلون بهذا الفرع"
          headerAction={
            <Button onClick={() => setInviteOpen(true)} className="h-9 font-semibold text-xs">
              <UserPlus className="me-1.5 h-4 w-4" />
              دعوة موظف للفرع
            </Button>
          }
        />

        {/* Invite Dialog */}
        <FormDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title="دعوة موظف جديد للفرع"
          submitLabel="إرسال الدعوة"
          loading={inviteMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate({
              email: email.trim(),
              role,
              branchId,
            });
          }}
        >
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@restaurant.eg"
            required
          />

          <Select
            label="الدور الوظيفي بالفرع"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={[
              { label: 'طاقم المطبخ (Kitchen)', value: Role.KITCHEN },
              { label: 'مندوب توصيل (Delivery)', value: Role.DELIVERY },
              { label: 'استقبال وتأكيد طلبات (Staff)', value: Role.STAFF },
            ]}
          />
        </FormDialog>

        {/* Deactivate Confirm */}
        <ConfirmDialog
          open={Boolean(deactivateTarget)}
          onOpenChange={(open) => !open && setDeactivateTarget(null)}
          title={`إلغاء تفعيل حساب ${deactivateTarget?.name || ''}`}
          message="سيتم إيقاف حساب موظف الفرع وإلغاء جلسات دخوله."
          confirmLabel="تأكيد إلغاء التفعيل"
          loading={deactivateMutation.isPending}
          onConfirm={async () => {
            if (deactivateTarget) {
              await deactivateMutation.mutateAsync(deactivateTarget.id);
            }
          }}
        />

        {/* Generated Invite Modal */}
        <Dialog
          open={Boolean(invitationLinkData)}
          onOpenChange={(open) => !open && setInvitationLinkData(null)}
          title="تم إنشاء دعوة موظف الفرع"
          description="شارك هذا الرابط مع الموظف لتفعيل حسابه وتعيين كلمة المرور"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
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
