'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiPost, ApiError } from '../../lib/api';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function request(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiPost('/api/v1/auth/password-reset/request', { email });
      setRequested(true);
      setMessage('إذا كان البريد مسجلاً، فسيتم إرسال تعليمات إعادة التعيين.');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'تعذر طلب إعادة التعيين.');
    }
  }

  async function complete(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiPost('/api/v1/auth/password-reset/complete', { token, newPassword });
      setMessage('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.');
    } catch (completeError) {
      setError(completeError instanceof ApiError ? completeError.message : 'تعذر إكمال إعادة التعيين.');
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl"><h1 className="text-2xl font-black">إعادة تعيين كلمة المرور</h1>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<form onSubmit={request} className="mt-5 space-y-3"><label className="block text-sm font-semibold">البريد الإلكتروني<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2" dir="ltr" /></label><button className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white">طلب رمز إعادة التعيين</button></form>{requested && <form onSubmit={complete} className="mt-6 space-y-3 border-t pt-6"><label className="block text-sm font-semibold">الرمز<input required value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2" dir="ltr" /></label><label className="block text-sm font-semibold">كلمة المرور الجديدة<input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2" dir="ltr" /></label><button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white">تغيير كلمة المرور</button></form>}<Link href="/login" className="mt-6 block text-center text-sm font-semibold text-blue-600">العودة لتسجيل الدخول</Link></div></main>;
}
