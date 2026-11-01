'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiGet, apiPatch } from '../../../../lib/api';
import { getStoredUser } from '../../../../lib/auth';

type Settings = {
  countryCode: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultLocale: string;
  defaultCallingCode: string;
};

type Company = { settings?: Settings };

const defaults: Settings = {
  countryCode: '',
  defaultCurrency: '',
  defaultTimezone: '',
  defaultLocale: '',
  defaultCallingCode: '',
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user?.companyId) {
      setError('لا يوجد نطاق شركة مرتبط بهذا الحساب.');
      setLoading(false);
      return;
    }

    setCompanyId(user.companyId);
    void apiGet<Company>(`/api/v1/companies/${user.companyId}`)
      .then((company) => setSettings({ ...defaults, ...company.settings }))
      .catch((loadError) => setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل إعدادات الشركة.'))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await apiPatch<Settings>(`/api/v1/companies/${companyId}/settings`, settings);
      setSettings(updated);
      setMessage('تم حفظ إعدادات الشركة بنجاح.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="إعدادات الشركة والمطعم" description="العملة والمنطقة الزمنية واللغة الافتراضية قابلة للتعديل حسب إعدادات شركتك.">
      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل الإعدادات...</p> : (
        <form onSubmit={saveSettings} className="max-w-3xl space-y-5">
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
          {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
          <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            {([
              ['countryCode', 'الدولة الافتراضية', 'EG'],
              ['defaultCurrency', 'العملة الافتراضية', 'EGP'],
              ['defaultTimezone', 'المنطقة الزمنية', 'Africa/Cairo'],
              ['defaultLocale', 'اللغة الافتراضية', 'ar-EG'],
              ['defaultCallingCode', 'رمز الاتصال الهاتفي', '+20'],
            ] as const).map(([field, label, placeholder]) => (
              <label key={field} className="block text-sm font-semibold text-slate-700">
                {label}
                <input required value={settings[field]} onChange={(event) => setSettings((current) => ({ ...current, [field]: event.target.value }))} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" dir="ltr" />
              </label>
            ))}
          </section>
          <button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
        </form>
      )}
    </AppShell>
  );
}
