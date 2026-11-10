'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { PlatformAnalyticsResponseDto } from '@chatpilot/contracts';
import { formatCurrency } from '../../../../lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function AdminAnalyticsPage() {
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useQuery<PlatformAnalyticsResponseDto>({
    queryKey: ['analytics', 'platform'],
    queryFn: () => api.get<PlatformAnalyticsResponseDto>('/api/analytics/platform'),
  });

  if (isLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={4} cols={2} />
      </AppShell>
    );
  }

  if (error || !metrics) {
    return (
      <AppShell>
        <ErrorState onRetry={() => refetch()} />
      </AppShell>
    );
  }

  const orderStatsData = [
    { name: 'مكتملة', count: metrics.deliveredOrders, fill: '#10b981' },
    { name: 'ملغاة', count: metrics.cancelledOrders, fill: '#f43f5e' },
    { name: 'تعذر التوصيل', count: metrics.failedDeliveryOrders, fill: '#f59e0b' },
  ];

  const currencyGmvData = Object.entries(metrics.gmvByCurrency || {}).map(([currency, total]) => ({
    currency,
    total,
  }));

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            تحليلات المنصة المجمعة
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إحصائيات إجمالية لأداء الشركات المشتركة، توزيع الطلبات، وحجم البضائع المباعة
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Status Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">
                توزيع حالات الطلبات على مستوى المنصة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orderStatsData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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

          {/* Currency GMV Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">
                حجم مبيعات المطاعم (GMV) لكل عملة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                {currencyGmvData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currencyGmvData}
                        dataKey="total"
                        nameKey="currency"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ currency, total }) =>
                          `${currency}: ${formatCurrency(total, currency)}`
                        }
                      >
                        {currencyGmvData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    لا توجد طلبات مكتملة لتوليد مخطط العملات حالياً
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
