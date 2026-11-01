'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { ApiError, apiGet, apiPost } from '../../lib/api';
import { AuthUser, getStoredUser } from '../../lib/auth';

type Plan = {
  id: string;
  code: string;
  name: string;
  limits: { ordersPerMonth: number; tokensPerDay: number; branchesLimit: number };
};

type Company = { id: string; name: string; slug: string; status: string };
type Usage = {
  currentOrdersMonth: number;
  ordersLimit: number;
  percentOrdersUsed: number;
  currentTokensToday: number;
  tokensLimit: number;
  planCode: string;
  isOverLimit: boolean;
};

export default function BillingPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    if (!storedUser) return;
    setLoading(true);
    setError('');
    try {
      const availablePlans = await apiGet<Plan[]>('/api/v1/billing/plans');
      setPlans(availablePlans);
      setSelectedPlan((current) => current || availablePlans[0]?.id || '');
      if (storedUser.role === 'SUPER_ADMIN') {
        const availableCompanies = await apiGet<Company[]>('/api/v1/platform/companies');
        setCompanies(availableCompanies);
        setSelectedCompany((current) => current || availableCompanies[0]?.id || '');
      } else if (storedUser.companyId) {
        setUsage(await apiGet<Usage>(`/api/v1/billing/usage/${storedUser.companyId}`));
      }
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل بيانات الاشتراك والاستخدام.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function assign() {
    if (!selectedCompany || !selectedPlan) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/v1/billing/subscriptions/assign', { companyId: selectedCompany, planId: selectedPlan });
      setNotice('تم تعيين الخطة للشركة لمدة 30 يوماً.');
    } catch (assignError) {
      setError(assignError instanceof ApiError ? assignError.message : 'تعذر تعيين الخطة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="الاشتراكات والاستخدام" description="تُعرض حدود الاشتراك منفصلة عن قيمة مبيعات المطاعم.">
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل بيانات الاشتراك...</p> : user?.role === 'SUPER_ADMIN' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black">تعيين خطة لشركة</h2><div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">الشركة<select value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2"><option value="">اختر شركة</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name} ({company.slug})</option>)}</select></label><label className="text-sm font-semibold">الخطة<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>)}</select></label><button type="button" disabled={saving || !selectedCompany} onClick={() => void assign()} className="self-end rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تعيين الخطة'}</button></div></section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-right text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3">الخطة</th><th className="px-5 py-3">الطلبات الشهرية</th><th className="px-5 py-3">رموز AI اليومية</th><th className="px-5 py-3">حد الفروع</th></tr></thead><tbody className="divide-y divide-slate-100">{plans.map((plan) => <tr key={plan.id}><td className="px-5 py-4 font-bold">{plan.name} <span className="text-xs text-slate-400" dir="ltr">{plan.code}</span></td><td className="px-5 py-4">{plan.limits.ordersPerMonth || 'غير محدود'}</td><td className="px-5 py-4">{plan.limits.tokensPerDay || 'غير محدود'}</td><td className="px-5 py-4">{plan.limits.branchesLimit || 'غير محدود'}</td></tr>)}</tbody></table></section>
        </div>
      ) : usage ? (
        <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">الخطة الحالية</p><h2 className="mt-1 text-2xl font-black" dir="ltr">{usage.planCode}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${usage.isOverLimit ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{usage.isOverLimit ? 'تجاوز الحد' : 'ضمن الحد'}</span></div></section><section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">الطلبات هذا الشهر</p><p className="mt-2 text-3xl font-black" dir="ltr">{usage.currentOrdersMonth} / {usage.ordersLimit}</p><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${usage.percentOrdersUsed}%` }} /></div><p className="mt-2 text-xs text-slate-500">{usage.percentOrdersUsed}% مستخدم</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">رموز الذكاء الاصطناعي اليوم</p><p className="mt-2 text-3xl font-black" dir="ltr">{usage.currentTokensToday.toLocaleString('en-US')} / {usage.tokensLimit.toLocaleString('en-US')}</p></article></section></div>
      ) : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">لا تتوفر بيانات استخدام لهذا الحساب.</p>}
    </AppShell>
  );
}
