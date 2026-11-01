'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/app-shell';
import { ApiError, apiPost } from '../../../lib/api';

export default function MfaSetupPage() {
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiPost<typeof setup>('/api/v1/auth/mfa/setup')
      .then(setSetup)
      .catch((setupError) =>
        setError(
          setupError instanceof ApiError
            ? setupError.message
            : 'تعذر إعداد المصادقة متعددة العوامل.',
        ),
      );
  }, []);

  return (
    <AppShell
      title="إعداد المصادقة متعددة العوامل"
      description="احتفظ بالرمز السري ورموز الاسترداد في مكان آمن."
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {!setup && !error && (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          جارٍ إنشاء إعداد MFA...
        </p>
      )}
      {setup && (
        <div className="max-w-2xl space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">أضف الرابط التالي إلى تطبيق المصادقة:</p>
            <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs" dir="ltr">
              {setup.otpauthUri}
            </p>
            <p className="mt-4 text-sm text-slate-500">المفتاح السري</p>
            <p className="mt-1 font-bold" dir="ltr">
              {setup.secret}
            </p>
          </section>
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-black">رموز الاسترداد لمرة واحدة</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm" dir="ltr">
              {setup.recoveryCodes.map((code) => (
                <span key={code} className="rounded bg-white p-2 text-center">
                  {code}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
