'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api-client';
import { useAuth } from '../../providers/auth-provider';
import { useLocale } from '../../providers/locale-provider';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card';
import { Role } from '@chatpilot/contracts';
import { Lock, Mail, Eye, EyeOff, Globe } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const { refetchUser } = useAuth();
  const { locale, toggleLocale } = useLocale();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<{ success: boolean; user: { role: Role } }>('/api/auth/login', {
        email: email.trim(),
        password,
      });

      await refetchUser();

      if (redirectUrl) {
        router.push(redirectUrl);
        return;
      }

      // Role-specific redirect
      const role = res.user.role;
      switch (role) {
        case Role.SUPER_ADMIN:
          router.push('/admin/dashboard');
          break;
        case Role.COMPANY_ADMIN:
          router.push('/company/dashboard');
          break;
        case Role.BRANCH_MANAGER:
          router.push('/branch/dashboard');
          break;
        case Role.KITCHEN:
          router.push('/kitchen');
          break;
        case Role.DELIVERY:
          router.push('/delivery');
          break;
        case Role.STAFF:
          router.push('/staff');
          break;
        default:
          router.push('/');
      }
    } catch (err: any) {
      setError(
        err?.message || 'فشل تسجيل الدخول. يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-4">
      <div className="absolute top-4 end-4">
        <Button variant="outline" size="sm" onClick={toggleLocale} className="text-xs bg-white">
          <Globe className="me-1.5 h-3.5 w-3.5" />
          {locale === 'ar' ? 'English' : 'العربية'}
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black text-2xl shadow-md mb-3">
            CP
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ChatPilot | شات بايلوت
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            منصة إدارة المطاعم والعمليات التشغيلية الذكية
          </p>
        </div>

        <Card className="shadow-lg border-slate-200/80">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold">تسجيل الدخول</CardTitle>
            <CardDescription className="text-xs">
              أدخل بيانات حسابك للمتابعة إلى لوحة التحكم الخاصة بك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                  {error}
                </div>
              )}

              <div className="relative">
                <Input
                  label="البريد الإلكتروني"
                  type="email"
                  placeholder="admin@restaurant.eg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="ps-9"
                />
                <Mail className="absolute start-3 top-8 h-4 w-4 text-slate-400" />
              </div>

              <div className="relative">
                <Input
                  label="كلمة المرور"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="ps-9 pe-9"
                />
                <Lock className="absolute start-3 top-8 h-4 w-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-8 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => router.push('/reset-password')}
                  className="text-emerald-600 hover:underline font-semibold"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-base font-bold mt-2"
              >
                دخول إلى الحساب
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
