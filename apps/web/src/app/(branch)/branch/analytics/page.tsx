'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { DashboardCard } from '../../../../components/ui/dashboard-card';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { BranchFinancialResponseDto, BranchOperationalResponseDto } from '@chatpilot/contracts';
import { formatCurrency, formatDurationMinutes } from '../../../../lib/utils';
import { DollarSign, TrendingUp, ChefHat, Bike } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function BranchAnalyticsPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    data: financial,
    isLoading: finLoading,
    error: finError,
  } = useQuery<BranchFinancialResponseDto>({
    queryKey: ['analytics', 'branch', branchId, 'financial'],
    queryFn: () =>
      api.get<BranchFinancialResponseDto>(`/api/analytics/branch/${branchId}/financial`),
    enabled: Boolean(branchId),
  });

  const { data: operational, isLoading: opLoading } = useQuery<BranchOperationalResponseDto>({
    queryKey: ['analytics', 'branch', branchId, 'operational'],
    queryFn: () =>
      api.get<BranchOperationalResponseDto>(`/api/analytics/branch/${branchId}/operational`),
    enabled: Boolean(branchId),
  });

  if (finLoading || opLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={4} cols={3} />
      </AppShell>
    );
  }

  if (finError || !financial) {
    return (
      <AppShell>
        <ErrorState message="تعذر تحميل المؤشرات المالية للفرع. تأكد من امتلاك الصلاحية اللازمة." />
      </AppShell>
    );
  }

  const { financial: fData } = financial;
  const op = operational?.operational;

  const breakdownData = [
    { name: 'مبيعات الأصناف', amount: fData.gmvSubtotal },
    { name: 'رسوم التوصيل', amount: fData.gmvDelivery },
    { name: 'خسارة الإلغاءات', amount: fData.cancellationLoss },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            التقارير التحليلية للفرع
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مؤشرات الإيرادات والمبيعات الخاصة بفرعك ({fData.currency}) مع أوقات التشغيل الفعلية
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="إجمالي مبيعات الفرع (GMV)"
            value={formatCurrency(fData.gmvTotal, fData.currency)}
            subtitle="الطلبات المسلمة بنجاح"
            icon={DollarSign}
            accentColor="emerald"
          />
          <DashboardCard
            title="متوسط قيمة طلب الفرع"
            value={formatCurrency(fData.avgOrderValue, fData.currency)}
            subtitle="Average Order Value"
            icon={TrendingUp}
            accentColor="blue"
          />
          <DashboardCard
            title="متوسط تحضير المطبخ"
            value={formatDurationMinutes(op?.avgPrepDurationMinutes)}
            subtitle="سرعة إنجاز الوجبات"
            icon={ChefHat}
            accentColor="amber"
          />
          <DashboardCard
            title="متوسط توصيل السائق"
            value={formatDurationMinutes(op?.avgDeliveryDurationMinutes)}
            subtitle="مدة الطريق حتى العميل"
            icon={Bike}
            accentColor="purple"
          />
        </div>

        {/* Financial Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">
              توزيع الإيرادات المحققة والخسائر ({fData.currency})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val, fData.currency)}
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
