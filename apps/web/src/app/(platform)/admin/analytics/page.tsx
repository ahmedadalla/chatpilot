'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet } from '../../../../lib/api';

type Metrics = {
  day: string;
  totalCompanies: number;
  activeCompanies: number;
  totalBranches: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedDeliveryOrders: number;
  gmvByCurrency: Record<string, number>;
  saasMrrActiveCompanies: number;
};

export default function PlatformAnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiGet<Metrics>('/api/v1/analytics/platform')
      .then(setMetrics)
      .catch((loadError) =>
        setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل تحليلات المنصة.'),
      );
  }, []);

  return (
    <AppShell
      title="تحليلات المنصة"
      description="مؤشرات المنصة مع فصل إيرادات الاشتراكات عن قيمة طلبات المطاعم والعملات المختلفة."
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {!metrics && !error && (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          جارٍ تحميل التحليلات...
        </p>
      )}
      {metrics && (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['الشركات النشطة', metrics.activeCompanies],
              ['إجمالي الشركات', metrics.totalCompanies],
              ['الفروع النشطة', metrics.totalBranches],
              ['إجمالي الطلبات', metrics.totalOrders],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-black">تشغيل المنصة</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">المسلّمة</dt>
                  <dd className="mt-1 font-bold">{metrics.deliveredOrders}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">الملغاة</dt>
                  <dd className="mt-1 font-bold">{metrics.cancelledOrders}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">فشل التوصيل</dt>
                  <dd className="mt-1 font-bold">{metrics.failedDeliveryOrders}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">MRR الاشتراكات</dt>
                  <dd className="mt-1 font-bold" dir="ltr">
                    {metrics.saasMrrActiveCompanies.toLocaleString('en-US')} EGP
                  </dd>
                </div>
              </dl>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-black">GMV حسب العملة</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(metrics.gmvByCurrency).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد مبيعات مسلّمة.</p>
                ) : (
                  Object.entries(metrics.gmvByCurrency).map(([currency, value]) => (
                    <div
                      key={currency}
                      className="flex items-center justify-between border-b border-slate-100 pb-3"
                    >
                      <span className="font-bold" dir="ltr">
                        {currency}
                      </span>
                      <span dir="ltr">
                        {value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </div>
      )}
    </AppShell>
  );
}
