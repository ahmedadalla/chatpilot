'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet } from '../../../../lib/api';
import { getStoredUser } from '../../../../lib/auth';

type Metrics = {
  operational: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    failedDeliveryOrders: number;
    activeOrders: number;
    avgPrepDurationMinutes: number;
    avgDeliveryDurationMinutes: number;
  };
  financial: {
    gmvSubtotal: number;
    gmvDelivery: number;
    gmvTotal: number;
    avgOrderValue: number;
    currency: string;
    cancellationLoss: number;
  };
  totalMessages: number;
  aiTokensUsed: number;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency }).format(value);
}

export default function CompanyAnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.companyId) {
      setError('لا يوجد نطاق شركة مرتبط بهذا الحساب.');
      return;
    }
    void apiGet<Metrics>(`/api/v1/analytics/company/${user.companyId}`)
      .then(setMetrics)
      .catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل التحليلات.'));
  }, []);

  return (
    <AppShell title="تحليلات الشركة" description="المؤشرات المالية والتشغيلية المحسوبة من بيانات الطلبات الفعلية.">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {!metrics && !error && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل التحليلات...</p>}
      {metrics && (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['إجمالي المبيعات', money(metrics.financial.gmvTotal, metrics.financial.currency)],
              ['متوسط قيمة الطلب', money(metrics.financial.avgOrderValue, metrics.financial.currency)],
              ['الطلبات المسلّمة', metrics.operational.deliveredOrders.toLocaleString('ar-EG')],
              ['الطلبات النشطة', metrics.operational.activeOrders.toLocaleString('ar-EG')],
            ].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950" dir="ltr">{value}</p></article>)}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">التشغيل</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">إجمالي الطلبات</dt><dd className="mt-1 font-bold">{metrics.operational.totalOrders}</dd></div><div><dt className="text-slate-500">الملغاة</dt><dd className="mt-1 font-bold">{metrics.operational.cancelledOrders}</dd></div><div><dt className="text-slate-500">فشل التوصيل</dt><dd className="mt-1 font-bold">{metrics.operational.failedDeliveryOrders}</dd></div><div><dt className="text-slate-500">متوسط التحضير</dt><dd className="mt-1 font-bold">{metrics.operational.avgPrepDurationMinutes} دقيقة</dd></div><div><dt className="text-slate-500">متوسط التوصيل</dt><dd className="mt-1 font-bold">{metrics.operational.avgDeliveryDurationMinutes} دقيقة</dd></div></dl></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">المال والذكاء الاصطناعي</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">قيمة الوجبات</dt><dd className="mt-1 font-bold" dir="ltr">{money(metrics.financial.gmvSubtotal, metrics.financial.currency)}</dd></div><div><dt className="text-slate-500">رسوم التوصيل</dt><dd className="mt-1 font-bold" dir="ltr">{money(metrics.financial.gmvDelivery, metrics.financial.currency)}</dd></div><div><dt className="text-slate-500">خسائر الإلغاء</dt><dd className="mt-1 font-bold" dir="ltr">{money(metrics.financial.cancellationLoss, metrics.financial.currency)}</dd></div><div><dt className="text-slate-500">الرسائل</dt><dd className="mt-1 font-bold">{metrics.totalMessages}</dd></div><div><dt className="text-slate-500">رموز الذكاء الاصطناعي</dt><dd className="mt-1 font-bold">{metrics.aiTokensUsed.toLocaleString('en-US')}</dd></div></dl></article>
          </section>
        </div>
      )}
    </AppShell>
  );
}
