'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiPost } from '../../../../lib/api';

const providers = [
  {
    value: 'CLOUD_API',
    title: 'Meta Cloud API',
    description: 'الخيار الرسمي الموصى به للإنتاج.',
    risk: false,
  },
  {
    value: 'COEXISTENCE',
    title: 'Coexistence',
    description: 'تكامل رسمي مع تطبيق WhatsApp Business عند توفره.',
    risk: false,
  },
  {
    value: 'REGULAR_QR_PAIRING',
    title: 'QR Pairing',
    description: 'حل غير رسمي؛ قد يعرّض الرقم للفصل أو الحظر.',
    risk: true,
  },
] as const;

export default function CompanyWhatsAppPage() {
  const [provider, setProvider] = useState('CLOUD_API');
  const [businessConnectionId, setBusinessConnectionId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [result, setResult] = useState<{
    status?: string;
    qrDataUri?: string;
    pairingCode?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      setResult(
        await apiPost('/api/v1/whatsapp/connections', {
          provider,
          businessConnectionId,
          phoneNumber: phoneNumber || undefined,
          ...(provider === 'REGULAR_QR_PAIRING' ? { riskAcknowledged } : {}),
        }),
      );
    } catch (connectError) {
      setError(
        connectError instanceof ApiError ? connectError.message : 'تعذر إنشاء اتصال واتساب.',
      );
    } finally {
      setSaving(false);
    }
  }

  const selected = providers.find((item) => item.value === provider)!;
  return (
    <AppShell
      title="اتصال واتساب"
      description="اختر موفر الاتصال بعناية؛ يظل التفويض النهائي والتحقق من الحالة على الخادم."
    >
      <form onSubmit={connect} className="max-w-3xl space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {providers.map((item) => (
            <label
              key={item.value}
              className={`cursor-pointer rounded-xl border p-4 ${provider === item.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            >
              <input
                type="radio"
                name="provider"
                value={item.value}
                checked={provider === item.value}
                onChange={() => setProvider(item.value)}
                className="ml-2"
              />
              <span className="font-bold">{item.title}</span>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </label>
          ))}
        </section>
        {selected.risk && (
          <label className="block rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={riskAcknowledged}
              onChange={(event) => setRiskAcknowledged(event.target.checked)}
              className="ml-2"
              required
            />
            أقر بأن QR Pairing غير رسمي وقد يؤدي إلى فصل الرقم أو حظره.
          </label>
        )}
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <label className="text-sm font-semibold">
            معرف الاتصال التجاري
            <input
              required
              value={businessConnectionId}
              onChange={(event) => setBusinessConnectionId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              dir="ltr"
            />
          </label>
          <label className="text-sm font-semibold">
            رقم الهاتف
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              dir="ltr"
            />
          </label>
        </section>
        <button
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'جارٍ الإنشاء...' : 'إنشاء الاتصال'}
        </button>
        {result && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <p className="font-bold">
              الحالة: <span dir="ltr">{result.status || 'CREATED'}</span>
            </p>
            {result.pairingCode && (
              <p className="mt-2">
                رمز الاقتران: <span dir="ltr">{result.pairingCode}</span>
              </p>
            )}
            {result.qrDataUri && (
              <img
                src={result.qrDataUri}
                alt="WhatsApp pairing QR"
                className="mt-4 h-56 w-56 rounded bg-white p-2"
              />
            )}
          </section>
        )}
      </form>
    </AppShell>
  );
}
