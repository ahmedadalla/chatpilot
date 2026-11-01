'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet } from '../../../../lib/api';
import { getStoredUser } from '../../../../lib/auth';

type Operational = {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedDeliveryOrders: number;
  activeOrders: number;
  avgPrepDurationMinutes: number;
  avgDeliveryDurationMinutes: number;
};

export default function BranchOperationalAnalyticsPage() {
  const [metrics, setMetrics] = useState<Operational | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.branchId) {
      setError('لا يوجد فرع مرتبط بهذا الحساب.');
      return;
    }
    void apiGet<{ operational: Operational }>(`/api/v1/analytics/branch/${user.branchId}/operational`)
      .then((response) => setMetrics(response.operational))
      .catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل المؤشرات التشغيلية.'));
  }, []);

  return (
    <AppShell title="المؤشرات التشغيلية للفرع" description="بيانات التشغيل فقط، دون أي مؤشرات مالية.">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {!metrics && !error && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل المؤشرات...</p>}
      {metrics && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['إجمالي الطلبات', metrics.totalOrders],
        ['الطلبات المسلّمة', metrics.deliveredOrders],
        ['الطلبات النشطة', metrics.activeOrders],
        ['الملغاة', metrics.cancelledOrders],
        ['فشل التوصيل', metrics.failedDeliveryOrders],
        ['متوسط التحضير', `${metrics.avgPrepDurationMinutes} دقيقة`],
        ['متوسط التوصيل', `${metrics.avgDeliveryDurationMinutes} دقيقة`],
      ].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></article>)}</section>}
    </AppShell>
  );
}
