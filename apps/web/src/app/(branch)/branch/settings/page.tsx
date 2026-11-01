'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet, apiPatch } from '../../../../lib/api';
import { getStoredUser } from '../../../../lib/auth';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  deliveryFee: number | null;
  minOrder: number | null;
};

export default function BranchSettingsPage() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', deliveryFee: '', minOrder: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const branchId = getStoredUser()?.branchId;
    if (!branchId) {
      setError('لا يوجد فرع مرتبط بهذا الحساب.');
      return;
    }
    void apiGet<Branch>(`/api/v1/branches/${branchId}`)
      .then((response) => {
        setBranch(response);
        setForm({
          name: response.name,
          address: response.address || '',
          deliveryFee: String(response.deliveryFee ?? 0),
          minOrder: String(response.minOrder ?? 0),
        });
      })
      .catch((loadError) =>
        setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل إعدادات الفرع.'),
      );
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await apiPatch<Branch>(`/api/v1/branches/${branch.id}/settings`, {
        name: form.name,
        address: form.address,
        deliveryFee: Number(form.deliveryFee),
        minOrder: Number(form.minOrder),
      });
      setBranch(updated);
      setNotice('تم حفظ إعدادات الفرع.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر حفظ إعدادات الفرع.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="الإعدادات التشغيلية للفرع"
      description="إدارة اسم الفرع والعنوان والرسوم والحد الأدنى للطلب."
    >
      {!branch && !error && (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          جارٍ تحميل الإعدادات...
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {branch && (
        <form onSubmit={save} className="max-w-3xl space-y-5">
          {notice && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              {notice}
            </div>
          )}
          <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            <label className="text-sm font-semibold">
              اسم الفرع
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              العنوان
              <input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold">
              رسوم التوصيل
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.deliveryFee}
                onChange={(event) => setForm({ ...form, deliveryFee: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-semibold">
              الحد الأدنى للطلب
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.minOrder}
                onChange={(event) => setForm({ ...form, minOrder: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                dir="ltr"
              />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">
              المنطقة الزمنية الحالية: <span dir="ltr">{branch.timezone}</span>
            </p>
          </section>
          <button
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </form>
      )}
    </AppShell>
  );
}
