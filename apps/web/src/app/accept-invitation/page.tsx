'use client';

import { FormEvent, useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, ApiError } from '../../lib/api';
import { storeAuth } from '../../lib/auth';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const result = await apiPost('/api/v1/auth/invitations/accept', {
        token,
        password,
        name: name || undefined,
      });
      storeAuth(result as Parameters<typeof storeAuth>[0]);
      router.replace('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'تعذر قبول الدعوة.');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-7 shadow-xl"
      >
        <h1 className="text-2xl font-black">قبول دعوة الفريق</h1>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <label className="block text-sm font-semibold">
          رمز الدعوة
          <input
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2"
            dir="ltr"
          />
        </label>
        <label className="block text-sm font-semibold">
          الاسم
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          كلمة المرور
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2"
            dir="ltr"
          />
        </label>
        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white">
          إنشاء الحساب
        </button>
      </form>
    </main>
  );
}
