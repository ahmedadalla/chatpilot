'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({
        email,
        password,
        ...(totpCode ? { totpCode } : {}),
        ...(recoveryCode ? { recoveryCode } : {}),
      });
      router.replace('/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'تعذر تسجيل الدخول.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-950 p-10 text-white shadow-2xl lg:block">
          <p className="mb-6 text-sm font-semibold tracking-[0.3em] text-blue-200">CHATPILOT</p>
          <h1 className="text-4xl font-bold leading-tight">إدارة تجارتك التحادثية من مكان واحد</h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-blue-100">
            لوحة تشغيل متعددة الشركات والفروع للطلبات، المطبخ، التوصيل، واتساب، والتحليلات.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm text-blue-50">
            <div className="rounded-2xl bg-white/10 p-4">صلاحيات متعددة المستويات</div>
            <div className="rounded-2xl bg-white/10 p-4">تحديثات لحظية للطلبات</div>
            <div className="rounded-2xl bg-white/10 p-4">عزل كامل لبيانات الشركات</div>
            <div className="rounded-2xl bg-white/10 p-4">واجهة عربية وإنجليزية</div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
          <Link href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            العودة إلى الصفحة الرئيسية
          </Link>
          <div className="mt-8">
            <p className="text-sm font-medium text-slate-500">مرحباً بك في ChatPilot</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-slate-500">أدخل بيانات حسابك للوصول إلى لوحة التحكم.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium">
              البريد الإلكتروني
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </label>

            <label className="block text-sm font-medium">
              كلمة المرور
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
                dir="ltr"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold">رمز التحقق للمشرف العام (اختياري)</p>
              <p className="mt-1 text-xs text-slate-500">
                مطلوب فقط إذا كان حسابك محمياً بالمصادقة الثنائية.
              </p>
              <input
                inputMode="numeric"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="123456"
                dir="ltr"
              />
              <input
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="أو رمز استرداد لمرة واحدة"
                dir="ltr"
              />
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'جارٍ تسجيل الدخول...' : 'دخول إلى لوحة التحكم'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
