'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [step, setStep] = React.useState<'request' | 'complete'>(
    tokenFromUrl ? 'complete' : 'request',
  );
  const [email, setEmail] = React.useState('');
  const [token, setToken] = React.useState(tokenFromUrl || '');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/password-reset/request', { email: email.trim() });
      setSuccessMessage('إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رمز الاستعادة قريباً.');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (newPassword.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/password-reset/complete', {
        token: token.trim(),
        newPassword,
      });

      setSuccessMessage('تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'رمز الاستعادة غير صالح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              {step === 'request' ? 'استعادة كلمة المرور' : 'تعيين كلمة مرور جديدة'}
            </CardTitle>
            <CardDescription className="text-xs">
              {step === 'request'
                ? 'أدخل بريدك الإلكتروني المسجل لإرسال تعليمات إعادة التعيين'
                : 'أدخل رمز الاستعادة وكلمة المرور الجديدة لحسابك'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage ? (
              <div className="space-y-4 text-center py-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{successMessage}</p>
                <Link href="/login" className="inline-block mt-2">
                  <Button variant="default" size="sm">
                    العودة لصفحة الدخول
                  </Button>
                </Link>
              </div>
            ) : step === 'request' ? (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
                )}

                <div className="relative">
                  <Input
                    label="البريد الإلكتروني"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@restaurant.eg"
                    className="ps-9"
                  />
                  <Mail className="absolute start-3 top-8 h-4 w-4 text-slate-400" />
                </div>

                <Button type="submit" loading={loading} className="w-full h-10 mt-2">
                  إرسال رابط الاستعادة
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('complete')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    لديك رمز استعادة بالفعل؟ أدخله هنا
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
                )}

                <Input
                  label="رمز الاستعادة (Token)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="أدخل الرمز المستلم"
                />

                <Input
                  label="كلمة المرور الجديدة"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="8 أحرف على الأقل"
                />

                <Input
                  label="تأكيد كلمة المرور"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="أعد إدخال كلمة المرور"
                />

                <Button type="submit" loading={loading} className="w-full h-10 mt-2">
                  تأكيد كلمة المرور الجديدة
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 font-semibold"
              >
                <ArrowLeft className="me-1 h-3.5 w-3.5" />
                العودة إلى تسجيل الدخول
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
