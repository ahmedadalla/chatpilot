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
import { CompanyAnalyticsResponseDto } from '@chatpilot/contracts';
import { formatCurrency, formatDurationMinutes } from '../../../../lib/utils';
import { DollarSign, TrendingUp, ChefHat, Bike } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function CompanyAnalyticsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId;

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useQuery<CompanyAnalyticsResponseDto>({
    queryKey: ['analytics', 'company', companyId],
    queryFn: () => api.get<CompanyAnalyticsResponseDto>(`/api/analytics/company/${companyId}`),
    enabled: Boolean(companyId),
  });

  if (isLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={4} cols={3} />
      </AppShell>
    );
  }

  if (error || !analytics) {
    return (
      <AppShell>
        <ErrorState onRetry={() => refetch()} />
      </AppShell>
    );
  }

  const { operational, financial } = analytics;

  const orderStatsData = [
    { name: 'مكتملة', count: operational.deliveredOrders, fill: '#10b981' },
    { name: 'نشطة حالياً', count: operational.activeOrders, fill: '#3b82f6' },
    { name: 'ملغاة', count: operational.cancelledOrders, fill: '#f43f5e' },
    { name: 'تعذر التوصيل', count: operational.failedDeliveryOrders, fill: '#f59e0b' },
  ];

  const financialData = [
    { name: 'مبيعات الأصناف (Subtotal)', amount: financial.gmvSubtotal },
    { name: 'رسوم التوصيل (Delivery)', amount: financial.gmvDelivery },
    { name: 'خسارة الإلغاءات (Loss)', amount: financial.cancellationLoss },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            التقارير التحليلية والمالية
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تحليل دقيق لأداء فروع المطعم، حجم المبيعات الإجمالي ({financial.currency})، ومتوسط أوقات
            التشغيل
          </p>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="إجمالي حجم المبيعات"
            value={formatCurrency(financial.gmvTotal, financial.currency)}
            subtitle="قيمة الطلبات المسلمة بنجاح"
            icon={DollarSign}
            accentColor="emerald"
          />
          <DashboardCard
            title="متوسط قيمة الطلب"
            value={formatCurrency(financial.avgOrderValue, financial.currency)}
            subtitle="Average Order Value"
            icon={TrendingUp}
            accentColor="blue"
          />
          <DashboardCard
            title="متوسط وقت المطبخ"
            value={formatDurationMinutes(operational.avgPrepDurationMinutes)}
            subtitle="من التأكيد حتى الجاهزية للتوصيل"
            icon={ChefHat}
            accentColor="amber"
          />
          <DashboardCard
            title="متوسط وقت التوصيل"
            value={formatDurationMinutes(operational.avgDeliveryDurationMinutes)}
            subtitle="مدة مسار السائق حتى التسليم"
            icon={Bike}
            accentColor="purple"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operational Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">توزيع حالات طلبات الشركة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orderStatsData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Financial Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">
                تفاصيل الإيرادات والخسائر ({financial.currency})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val, financial.currency)}
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
      </div>
    </AppShell>
  );
}
