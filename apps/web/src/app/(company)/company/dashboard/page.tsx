'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { DashboardCard } from '../../../../components/ui/dashboard-card';
import { CardSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { CompanyAnalyticsResponseDto } from '@chatpilot/contracts';
import { formatCurrency, formatDurationMinutes } from '../../../../lib/utils';
import {
  ShoppingBag,
  ChefHat,
  Bike,
  XCircle,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export default function CompanyDashboardPage() {
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

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ['whatsapp', 'connections'],
    queryFn: () => api.get<any[]>('/api/whatsapp/connections'),
    enabled: Boolean(companyId),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            لوحة تحكم الشركة | {user?.company?.name || 'المطعم'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة حية للطلبات النشطة، عمليات المطبخ والتوصيل، أداء القنوات، والمبيعات
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error || !analytics ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            {/* Operational Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard
                title="الطلبات النشطة الآن"
                value={analytics.operational.activeOrders}
                subtitle="قيد المراجعة أو التحضير أو التوصيل"
                icon={ShoppingBag}
                accentColor="blue"
              />
              <DashboardCard
                title="إجمالي طلبات اليوم"
                value={analytics.operational.totalOrders}
                subtitle={`${analytics.operational.deliveredOrders} تم إكمالها`}
                icon={TrendingUp}
                accentColor="purple"
              />
              <DashboardCard
                title="متوسط مدة التحضير"
                value={formatDurationMinutes(analytics.operational.avgPrepDurationMinutes)}
                subtitle="من القبول حتى الجاهزية للتوصيل"
                icon={ChefHat}
                accentColor="amber"
              />
              <DashboardCard
                title="متوسط مدة التوصيل"
                value={formatDurationMinutes(analytics.operational.avgDeliveryDurationMinutes)}
                subtitle="من استلام المندوب حتى التسليم"
                icon={Bike}
                accentColor="emerald"
              />
            </div>

            {/* Financial Performance Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DashboardCard
                title="إجمالي المبيعات (GMV)"
                value={formatCurrency(analytics.financial.gmvTotal, analytics.financial.currency)}
                subtitle="قيمة الطلبات المسلمة بنجاح"
                icon={DollarSign}
                accentColor="emerald"
              />
              <DashboardCard
                title="متوسط قيمة الطلب"
                value={formatCurrency(
                  analytics.financial.avgOrderValue,
                  analytics.financial.currency,
                )}
                subtitle="Average Order Value"
                icon={TrendingUp}
                accentColor="blue"
              />
              <DashboardCard
                title="الخسارة من الإلغاءات"
                value={formatCurrency(
                  analytics.financial.cancellationLoss,
                  analytics.financial.currency,
                )}
                subtitle={`${analytics.operational.cancelledOrders} طلبات ملغاة`}
                icon={XCircle}
                accentColor="rose"
              />
            </div>

            {/* WhatsApp Integration Status & Operational Alerts */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    حالة قنوات المحادثات وواتساب
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إجمالي الرسائل المعالجة: {analytics.totalMessages} رسالة • رموز الذكاء
                    الاصطناعي: {analytics.aiTokensUsed}
                  </p>
                </div>
                <Link
                  href="/company/whatsapp"
                  className="text-xs text-emerald-600 font-bold hover:underline"
                >
                  إدارة القنوات →
                </Link>
              </div>

              {connections.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connections.map((c: any) => (
                    <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-800">{c.provider}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {c.phoneNumber || c.businessConnectionId}
                      </p>
                      {c.branch && (
                        <p className="text-[11px] text-slate-400 mt-1">فرع: {c.branch.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300">
                  <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">لم يتم ربط أي قناة واتساب بعد</p>
                  <p className="text-xs text-slate-500 mt-1">
                    قم بربط رقم واتساب لبدء تلقي طلبات العملاء الذكية عبر المحادثة.
                  </p>
                  <Link href="/company/whatsapp" className="inline-block mt-3">
                    <span className="text-xs font-bold text-emerald-600 hover:underline">
                      + إعداد ربط واتساب الآن
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
