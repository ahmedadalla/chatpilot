'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { apiDelete, apiGet, apiPost, ApiError } from '../../../../lib/api';

type Category = { id: string; name: string };
type Item = { id: string; name: string; description: string | null; price: number; isActive: boolean; category?: Category };

export default function CompanyMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [item, setItem] = useState({ name: '', description: '', price: '', categoryId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCategories, nextItems] = await Promise.all([
        apiGet<Category[]>('/api/v1/menu/categories'),
        apiGet<Item[]>('/api/v1/menu/items'),
      ]);
      setCategories(nextCategories);
      setItems(nextItems);
      setItem((current) => ({ ...current, categoryId: current.categoryId || nextCategories[0]?.id || '' }));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل القائمة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setSaving(true);
    try {
      await apiPost('/api/v1/menu/categories', { name: categoryName.trim() });
      setCategoryName('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر إنشاء التصنيف.');
    } finally {
      setSaving(false);
    }
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiPost('/api/v1/menu/items', { ...item, price: Number(item.price) });
      setItem({ name: '', description: '', price: '', categoryId: categories[0]?.id || '' });
      await load();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر إنشاء الوجبة.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveItem(id: string) {
    if (!window.confirm('هل تريد أرشفة هذه الوجبة؟')) return;
    try {
      await apiDelete(`/api/v1/menu/items/${id}`);
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof ApiError ? archiveError.message : 'تعذر أرشفة الوجبة.');
    }
  }

  return (
    <AppShell title="قائمة الطعام" description="إدارة التصنيفات والوجبات المشتركة لجميع فروع الشركة.">
      <div className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={createCategory} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">إضافة تصنيف</h2>
            <p className="mt-1 text-sm text-slate-500">التصنيف ينظم الوجبات في القائمة.</p>
            <input required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="مثال: الأطباق الرئيسية" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2" />
            <button disabled={saving} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">حفظ التصنيف</button>
            <div className="mt-5 flex flex-wrap gap-2">{categories.map((category) => <span key={category.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{category.name}</span>)}</div>
          </form>
          <form onSubmit={createItem} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="font-bold text-slate-900">إضافة وجبة</h2><p className="mt-1 text-sm text-slate-500">السعر يحفظ كقيمة مرجعية وتستخدمه الطلبات من الخادم.</p></div>
            <label className="text-sm font-semibold">اسم الوجبة<input required value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-semibold">التصنيف<select required value={item.categoryId} onChange={(e) => setItem({ ...item, categoryId: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="text-sm font-semibold">السعر<input required type="number" min="0" step="0.01" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" dir="ltr" /></label>
            <label className="text-sm font-semibold">الوصف<input value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-2"><button disabled={saving || categories.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ الوجبة'}</button></div>
          </form>
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل القائمة...</p> : items.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد وجبات بعد. أنشئ تصنيفاً ثم أضف أول وجبة.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-4">الوجبة</th><th className="px-5 py-4">التصنيف</th><th className="px-5 py-4">السعر</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">إجراء</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((menuItem) => <tr key={menuItem.id}><td className="px-5 py-4"><p className="font-bold">{menuItem.name}</p><p className="text-xs text-slate-400">{menuItem.description}</p></td><td className="px-5 py-4 text-slate-500">{menuItem.category?.name || '—'}</td><td className="px-5 py-4 font-bold" dir="ltr">{menuItem.price.toFixed(2)} EGP</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">نشط</span></td><td className="px-5 py-4"><button type="button" onClick={() => void archiveItem(menuItem.id)} className="text-xs font-bold text-rose-600 hover:underline">أرشفة</button></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </AppShell>
  );
}
