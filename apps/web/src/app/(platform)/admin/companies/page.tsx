'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { apiGet, ApiError } from '../../../../lib/api';

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  branchCount: number;
  userCount: number;
  orderCount: number;
  createdAt: string;
};

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await apiGet<Company[]>('/api/v1/platform/companies'));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل الشركات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell title="الشركات والمنصة" description="نظرة عامة على العملاء والفروع والنشاط. كل فحص تفصيلي لمنشأة يسجل في سجل التدقيق.">
      <div className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل الشركات...</p> : companies.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد شركات مسجلة بعد.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-4">الشركة</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">الفروع</th><th className="px-5 py-4">المستخدمون</th><th className="px-5 py-4">الطلبات</th><th className="px-5 py-4">تاريخ الإنشاء</th></tr></thead><tbody className="divide-y divide-slate-100">{companies.map((company) => <tr key={company.id}><td className="px-5 py-4"><p className="font-bold">{company.name}</p><p className="text-xs text-slate-400" dir="ltr">{company.slug}</p></td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${company.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : company.status === 'SUSPENDED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{company.status}</span></td><td className="px-5 py-4">{company.branchCount}</td><td className="px-5 py-4">{company.userCount}</td><td className="px-5 py-4">{company.orderCount}</td><td className="px-5 py-4 text-slate-500" dir="ltr">{new Date(company.createdAt).toLocaleDateString('ar-EG')}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </AppShell>
  );
}
