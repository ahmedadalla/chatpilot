'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { DashboardCard } from '../../../../components/ui/dashboard-card';
import { CardSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { BranchOperationalResponseDto } from '@chatpilot/contracts';
import { formatDurationMinutes } from '../../../../lib/utils';
import { ShoppingBag, ChefHat, Bike, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function BranchDashboardPage() {
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    data: operational,
    isLoading,
    error,
    refetch,
  } = useQuery<BranchOperationalResponseDto>({
    queryKey: ['analytics', 'branch', branchId, 'operational'],
    queryFn: () =>
      api.get<BranchOperationalResponseDto>(`/api/analytics/branch/${branchId}/operational`),
    enabled: Boolean(branchId),
  });

  if (!branchId) {
    return (
      <AppShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800">حسابك غير مرتبط بفرع تشغيلي محدد</h3>
          <p className="text-xs text-slate-500 mt-1">
            يرجى مراجعة مدير الشركة لتعيين فرع تشغيلي لحسابك.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              لوحة الفرع التشغيلية | {user?.branch?.name || 'الفرع'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              متابعة طابور تحضير المطبخ، مناديب التوصيل، والطلبات الجارية للفرع
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/branch/kitchen-monitor">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs">
                <ChefHat className="h-4 w-4 text-amber-600" />
                مراقبة المطبخ
              </span>
            </Link>
            <Link href="/branch/delivery-monitor">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs">
                <Bike className="h-4 w-4 text-emerald-600" />
                مراقبة التوصيل
              </span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error || !operational ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard
                title="الطلبات النشطة بالفرع"
                value={operational.operational.activeOrders}
                subtitle="قيد التحضير والتوصيل"
                icon={ShoppingBag}
                accentColor="blue"
              />
              <DashboardCard
                title="الطلبات المكتملة بنجاح"
                value={operational.operational.deliveredOrders}
                subtitle="تم تسليمها للعميل"
                icon={CheckCircle2}
                accentColor="emerald"
              />
              <DashboardCard
                title="متوسط تحضير المطبخ"
                value={formatDurationMinutes(operational.operational.avgPrepDurationMinutes)}
                subtitle="من قبول الطلب حتى جاهزيته"
                icon={ChefHat}
                accentColor="amber"
              />
              <DashboardCard
                title="متوسط مدة التوصيل"
                value={formatDurationMinutes(operational.operational.avgDeliveryDurationMinutes)}
                subtitle="مسار السائق حتى التسليم"
                icon={Bike}
                accentColor="purple"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DashboardCard
                title="الطلبات الملغاة بالفرع"
                value={operational.operational.cancelledOrders}
                subtitle="إلغاء إداري أو طلب عميل"
                icon={XCircle}
                accentColor="rose"
              />
              <DashboardCard
                title="فشل التوصيل"
                value={operational.operational.failedDeliveryOrders}
                subtitle="تعذر الوصول للعنوان أو عدم الرد"
                icon={AlertCircle}
                accentColor="amber"
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
