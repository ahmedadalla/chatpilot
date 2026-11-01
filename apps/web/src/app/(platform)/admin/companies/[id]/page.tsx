'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../../components/app-shell';
import { ApiError, apiGet, apiPatch } from '../../../../../lib/api';

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  settings?: { defaultCurrency: string; defaultTimezone: string; defaultLocale: string };
  branches: Array<{ id: string; name: string; code: string; isActive: boolean }>;
  _count: { users: number; orders: number; whatsAppConnections: number };
};

export default function PlatformCompanyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!params.id || !reason.trim()) return;
    setError('');
    try {
      setCompany(
        await apiGet<Company>(
          `/api/v1/platform/companies/${params.id}?reason=${encodeURIComponent(reason)}`,
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل تفاصيل الشركة.');
    }
  }

  useEffect(() => {
    setCompany(null);
  }, [params.id]);

  async function changeStatus(action: 'suspend' | 'activate') {
    if (!company || !reason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPatch(
        `/api/v1/companies/${company.id}/${action}`,
        action === 'suspend' ? { reason } : {},
      );
      setNotice(action === 'suspend' ? 'تم تعليق الشركة.' : 'تم تفعيل الشركة.');
      await load();
    } catch (statusError) {
      setError(statusError instanceof ApiError ? statusError.message : 'تعذر تحديث حالة الشركة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="تفاصيل الشركة"
      description="أي فحص لمنشأة عميلة يتطلب سبباً ويُسجل في سجل التدقيق."
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="block text-sm font-bold text-amber-900">
            سبب الفحص أو الإجراء
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="مثال: متابعة بلاغ دعم رقم 123"
              className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              تحميل التفاصيل
            </button>
            {company?.status === 'SUSPENDED' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeStatus('activate')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                تفعيل الشركة
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void changeStatus('suspend')}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                تعليق الشركة
              </button>
            )}
          </div>
        </section>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {notice}
          </div>
        )}
        {company && (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['الحالة', company.status],
                ['المستخدمون', company._count.users],
                ['الطلبات', company._count.orders],
                ['اتصالات واتساب', company._count.whatsAppConnections],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{label}</p>
                  <p
                    className="mt-2 text-xl font-black"
                    dir={typeof value === 'string' && label !== 'الحالة' ? 'ltr' : undefined}
                  >
                    {value}
                  </p>
                </article>
              ))}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-black">
                {company.name}{' '}
                <span className="text-sm font-normal text-slate-500" dir="ltr">
                  ({company.slug})
                </span>
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                العملة: {company.settings?.defaultCurrency || '—'} · المنطقة الزمنية:{' '}
                <span dir="ltr">{company.settings?.defaultTimezone || '—'}</span>
              </p>
              <div className="mt-5 space-y-3">
                {company.branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                  >
                    <span className="font-semibold">
                      {branch.name}{' '}
                      <span className="text-xs text-slate-400" dir="ltr">
                        ({branch.code})
                      </span>
                    </span>
                    <span className={branch.isActive ? 'text-emerald-600' : 'text-slate-400'}>
                      {branch.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
