'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToast } from '../../../../components/ui/toast';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { GitBranch, ShieldCheck } from 'lucide-react';

export default function BranchSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [deliveryFee, setDeliveryFee] = React.useState(20);
  const [minOrder, setMinOrder] = React.useState(50);

  const { data: branch, isLoading } = useQuery<any>({
    queryKey: ['branch', branchId],
    queryFn: () => api.get<any>(`/api/branches/${branchId}`),
    enabled: Boolean(branchId),
  });

  React.useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setAddress(branch.address || '');
      setDeliveryFee(branch.deliveryFee || 20);
      setMinOrder(branch.minOrder || 50);
    }
  }, [branch]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/api/branches/${branchId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] });
      success('تم حفظ إعدادات الفرع بنجاح');
    },
    onError: (err: any) => toastError('فشل حفظ الإعدادات', err?.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: name.trim(),
      address: address.trim() || undefined,
      deliveryFee: Number(deliveryFee),
      minOrder: Number(minOrder),
    });
  };

  if (isLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={3} cols={2} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            إعدادات الفرع التشغيلية
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تعديل رسوم التوصيل، الحد الأدنى للطلب، والعنوان المعتمد لفرعك
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <GitBranch className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">البيانات التشغيلية للفرع</CardTitle>
              </div>
              <CardDescription className="text-xs">
                رمز الفرع:{' '}
                <span className="font-mono font-bold text-slate-700">{branch?.code}</span> • المنطقة
                الزمنية: <span className="font-mono">{branch?.timezone}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="اسم الفرع"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="العنوان التفصيلي للفرع"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، الحي، المعالم المميزة..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </CardContent>
          </Card>

          <Button
            type="submit"
            loading={saveMutation.isPending}
            className="h-11 px-8 font-bold text-base shadow-sm"
          >
            <ShieldCheck className="me-2 h-4 w-4" />
            حفظ إعدادات الفرع
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
