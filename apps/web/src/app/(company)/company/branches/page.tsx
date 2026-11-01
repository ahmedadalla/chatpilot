'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { apiDelete, apiGet, apiPost, ApiError } from '../../../../lib/api';

type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  deliveryFee: number | null;
  minOrder: number | null;
};

export default function CompanyBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    timezone: 'Africa/Cairo',
    deliveryFee: '0',
    minOrder: '0',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBranches(await apiGet<Branch[]>('/api/v1/branches'));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل الفروع.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/v1/branches', {
        ...form,
        deliveryFee: Number(form.deliveryFee),
        minOrder: Number(form.minOrder),
      });
      setForm({
        code: '',
        name: '',
        address: '',
        timezone: 'Africa/Cairo',
        deliveryFee: '0',
        minOrder: '0',
      });
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر إنشاء الفرع.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(branch: Branch) {
    if (!window.confirm(`هل تريد تعطيل ${branch.name}؟`)) return;
    try {
      await apiDelete(`/api/v1/branches/${branch.id}`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'تعذر تعطيل الفرع.');
    }
  }

  return (
    <AppShell
      title="فروع الشركة"
      description="إدارة الفروع، الرسوم، الحد الأدنى للطلب، والمنطقة الزمنية."
    >
      <div className="space-y-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            {formOpen ? 'إغلاق النموذج' : '+ إضافة فرع'}
          </button>
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        {formOpen && (
          <form
            onSubmit={createBranch}
            className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 md:grid-cols-2"
          >
            <label className="text-sm font-semibold">
              رمز الفرع
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-semibold">
              اسم الفرع
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold md:col-span-2">
              العنوان
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold">
              المنطقة الزمنية
              <input
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-semibold">
              رسوم التوصيل
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deliveryFee}
                onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-semibold">
              الحد الأدنى للطلب
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minOrder}
                onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                dir="ltr"
              />
            </label>
            <div className="md:col-span-2">
              <button
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ الفرع'}
              </button>
            </div>
          </form>
        )}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-slate-500">جارٍ تحميل الفروع...</p>
          ) : branches.length === 0 ? (
            <p className="p-8 text-center text-slate-500">لا توجد فروع بعد. أضف أول فرع للبدء.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-4">الرمز</th>
                    <th className="px-5 py-4">الاسم</th>
                    <th className="px-5 py-4">المنطقة الزمنية</th>
                    <th className="px-5 py-4">الرسوم</th>
                    <th className="px-5 py-4">الحالة</th>
                    <th className="px-5 py-4">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches.map((branch) => (
                    <tr key={branch.id}>
                      <td className="px-5 py-4 font-bold" dir="ltr">
                        {branch.code}
                      </td>
                      <td className="px-5 py-4">{branch.name}</td>
                      <td className="px-5 py-4 text-slate-500" dir="ltr">
                        {branch.timezone}
                      </td>
                      <td className="px-5 py-4" dir="ltr">
                        {branch.deliveryFee ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${branch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {branch.isActive ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {branch.isActive && (
                          <button
                            type="button"
                            onClick={() => void deactivate(branch)}
                            className="text-xs font-bold text-rose-600 hover:underline"
                          >
                            تعطيل
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
