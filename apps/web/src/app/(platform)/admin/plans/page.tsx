'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { useToast } from '../../../../components/ui/toast';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { formatCurrency } from '../../../../lib/utils';
import { Plus, CheckCircle2, CreditCard } from 'lucide-react';

interface Plan {
  id: string;
  code: string;
  name: string;
  limits: {
    monthlyPrice?: number;
    maxOrders?: number;
    maxBranches?: number;
    maxStaff?: number;
  };
  createdAt: string;
}

export default function AdminPlansPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);

  // Create Form State
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [monthlyPrice, setMonthlyPrice] = React.useState(2500);
  const [maxOrders, setMaxOrders] = React.useState(5000);
  const [maxBranches, setMaxBranches] = React.useState(3);

  // Assign Form State
  const [targetCompanyId, setTargetCompanyId] = React.useState('');
  const [selectedPlanId, setSelectedPlanId] = React.useState('');

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<Plan[]>('/api/billing/plans'),
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['platform', 'companies'],
    queryFn: () => api.get<any[]>('/api/platform/companies'),
  });

  const createPlanMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/billing/plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      setCreateOpen(false);
      setCode('');
      setName('');
      success('تم إنشاء الباقة بنجاح');
    },
    onError: (err: any) => toastError('فشل إنشاء الباقة', err?.message),
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/billing/subscriptions/assign', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'companies'] });
      setAssignOpen(false);
      success('تم تعيين الاشتراك للشركة بنجاح وتفعيل فترة 30 يوماً');
    },
    onError: (err: any) => toastError('فشل تعيين الاشتراك', err?.message),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              باقات SaaS والاشتراكات
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              إدارة باقات أسعار المنصة، حدود الاستهلاك، وتعيين الاشتراكات للمستأجرين
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(true)} className="h-9 text-xs">
              تعيين اشتراك لشركة
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="h-9 text-xs font-semibold">
              <Plus className="me-1 h-4 w-4" />
              باقة جديدة
            </Button>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const price = p.limits?.monthlyPrice || 2500;
              return (
                <Card key={p.id} className="relative overflow-hidden flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase text-slate-400">
                        {p.code}
                      </span>
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <CardTitle className="text-xl font-bold mt-1">{p.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {formatCurrency(price, 'EGP')}
                      </span>
                      <span className="text-xs text-slate-500 font-medium ms-1">/ شهرياً</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="text-xs space-y-2 border-t border-slate-100 pt-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>حد أقصى {p.limits?.maxOrders || 5000} طلب / شهرياً</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>حتى {p.limits?.maxBranches || 3} فروع تابعة</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>ذكاء اصطناعي وربط واتساب غير محدود</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Plan Dialog */}
        <FormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="إنشاء باقة اشتراك جديدة"
          submitLabel="حفظ الباقة"
          loading={createPlanMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            createPlanMutation.mutate({
              code: code.trim().toUpperCase(),
              name: name.trim(),
              limits: {
                monthlyPrice: Number(monthlyPrice),
                maxOrders: Number(maxOrders),
                maxBranches: Number(maxBranches),
              },
            });
          }}
        >
          <Input
            label="رمز الباقة (Code)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PRO_PLUS"
            required
          />
          <Input
            label="اسم الباقة"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="الباقة الاحترافية الموسعة"
            required
          />
          <Input
            label="السعر الشهري (EGP)"
            type="number"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(Number(e.target.value))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الحد الأقصى للطلبات"
              type="number"
              value={maxOrders}
              onChange={(e) => setMaxOrders(Number(e.target.value))}
              required
            />
            <Input
              label="الحد الأقصى للفروع"
              type="number"
              value={maxBranches}
              onChange={(e) => setMaxBranches(Number(e.target.value))}
              required
            />
          </div>
        </FormDialog>

        {/* Assign Subscription Dialog */}
        <FormDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          title="تعيين اشتراك لشركة مطاعم"
          description="تفعيل باقة اشتراك لمدة 30 يوماً لحساب المستأجر"
          submitLabel="تأكيد الاشتراك"
          loading={assignMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            assignMutation.mutate({
              companyId: targetCompanyId,
              planId: selectedPlanId,
            });
          }}
        >
          <Select
            label="اختر الشركة المستهدفة"
            value={targetCompanyId}
            onChange={(e) => setTargetCompanyId(e.target.value)}
            options={[
              { label: 'اختر الشركة...', value: '' },
              ...companies.map((c) => ({ label: `${c.name} (@${c.slug})`, value: c.id })),
            ]}
            required
          />

          <Select
            label="اختر باقة الاشتراك"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            options={[
              { label: 'اختر الباقة...', value: '' },
              ...plans.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id })),
            ]}
            required
          />
        </FormDialog>
      </div>
    </AppShell>
  );
}
