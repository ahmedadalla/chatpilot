'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DashboardCard } from '../../../../components/ui/dashboard-card';
import { CardSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { PlatformAnalyticsResponseDto } from '@chatpilot/contracts';
import { formatCurrency } from '../../../../lib/utils';
import {
  Building2,
  GitBranch,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  TrendingUp,
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useQuery<PlatformAnalyticsResponseDto>({
    queryKey: ['analytics', 'platform'],
    queryFn: () => api.get<PlatformAnalyticsResponseDto>('/api/analytics/platform'),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            نظرة عامة على المنصة
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مؤشرات الأداء الرئيسية للشركات، الفروع، وإيرادات الاشتراكات عبر جميع المستأجرين
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : metrics ? (
          <>
            {/* Primary SaaS KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard
                title="الشركات المسجلة"
                value={metrics.totalCompanies}
                subtitle={`${metrics.activeCompanies} شركة نشطة`}
                icon={Building2}
                accentColor="blue"
              />
              <DashboardCard
                title="إجمالي الفروع النشطة"
                value={metrics.totalBranches}
                subtitle="فروع قيد التشغيل"
                icon={GitBranch}
                accentColor="purple"
              />
              <DashboardCard
                title="إيرادات SaaS الشهرية (MRR)"
                value={formatCurrency(metrics.saasMrrActiveCompanies, 'EGP')}
                subtitle="إيرادات باقات البرمجيات"
                icon={CreditCard}
                accentColor="emerald"
              />
              <DashboardCard
                title="إجمالي الطلبات المنفذة"
                value={metrics.totalOrders}
                subtitle={`${metrics.deliveredOrders} تم توصيلها`}
                icon={ShoppingBag}
                accentColor="amber"
              />
            </div>

            {/* Operational Order Statuses */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DashboardCard
                title="الطلبات المكتملة بنجاح"
                value={metrics.deliveredOrders}
                subtitle="تسليم ناجح للعملاء"
                icon={CheckCircle2}
                accentColor="emerald"
              />
              <DashboardCard
                title="الطلبات الملغاة"
                value={metrics.cancelledOrders}
                subtitle="إلغاءات قبل أو أثناء التحضير"
                icon={XCircle}
                accentColor="rose"
              />
              <DashboardCard
                title="فشل التوصيل"
                value={metrics.failedDeliveryOrders}
                subtitle="تعذر التسليم من مسار التوصيل"
                icon={AlertCircle}
                accentColor="amber"
              />
            </div>

            {/* Currency-Separated Restaurant GMV */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    إجمالي حجم البضائع المباعة (GMV) حسب العملة
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مبيعات المطاعم الفعلية مفصولة بدقة لكل عملة دون أي تحويل اصطناعي لأسعار الصرف
                    (D-11, D-20)
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.entries(metrics.gmvByCurrency || {}).length > 0 ? (
                  Object.entries(metrics.gmvByCurrency).map(([curr, total]) => (
                    <div key={curr} className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                      <span className="text-xs font-semibold uppercase text-slate-500">
                        عملة {curr}
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {formatCurrency(total, curr)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <span className="text-xs font-semibold uppercase text-slate-500">عملة EGP</span>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {formatCurrency(0, 'EGP')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
