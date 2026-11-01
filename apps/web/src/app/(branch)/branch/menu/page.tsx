'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet, apiPut } from '../../../../lib/api';
import { getStoredUser } from '../../../../lib/auth';

type Item = { id: string; name: string; price: number; isAvailable: boolean; isOverridden: boolean; currency: string };
type Category = { id: string; name: string; items: Item[] };

export default function BranchMenuAvailabilityPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = getStoredUser()?.branchId;
    if (!id) {
      setError('لا يوجد فرع مرتبط بهذا الحساب.');
      setLoading(false);
      return;
    }
    setBranchId(id);
    void apiGet<Category[]>(`/api/v1/menu/branches/${id}/resolved`)
      .then(setCategories)
      .catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل إتاحة القائمة.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(item: Item) {
    if (!branchId) return;
    setSaving(item.id);
    setError('');
    try {
      await apiPut(`/api/v1/menu/branches/${branchId}/availability`, { menuItemId: item.id, isAvailable: !item.isAvailable });
      setCategories((current) => current.map((category) => ({ ...category, items: category.items.map((candidate) => candidate.id === item.id ? { ...candidate, isAvailable: !candidate.isAvailable, isOverridden: true } : candidate) })));
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر تحديث إتاحة الوجبة.');
    } finally {
      setSaving('');
    }
  }

  return (
    <AppShell title="إتاحة الوجبات بالفرع" description="تحكم في ظهور الوجبات للطلب داخل هذا الفرع.">
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل القائمة...</p> : <div className="space-y-5">{categories.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">لا توجد وجبات منشورة.</p> : categories.map((category) => <section key={category.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">{category.name}</h2></div><div className="divide-y divide-slate-100">{category.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-slate-500" dir="ltr">{item.price.toFixed(2)} {item.currency}</p></div><button type="button" disabled={saving === item.id} onClick={() => void toggle(item)} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${item.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{saving === item.id ? 'جارٍ...' : item.isAvailable ? 'متاح - إيقاف' : 'غير متاح - تفعيل'}</button></div>)}</div></section>)}</div>}
    </AppShell>
  );
}
