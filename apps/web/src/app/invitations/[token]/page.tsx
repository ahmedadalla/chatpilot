'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../providers/auth-provider';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/card';
import { Role } from '@chatpilot/contracts';
import { UserCheck } from 'lucide-react';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const { refetchUser } = useAuth();

  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (password.length < 8) {
      setError('يجب ألا تقل كلمة المرور عن 8 أحرف');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<{ success: boolean; user: { role: Role } }>(
        '/api/auth/invitations/accept',
        {
          token,
          password,
          name: name.trim() || undefined,
        },
      );

      await refetchUser();

      // Navigate to role dashboard
      const role = res.user.role;
      if (role === Role.COMPANY_ADMIN) {
        router.push('/company/dashboard');
      } else if (role === Role.BRANCH_MANAGER) {
        router.push('/branch/dashboard');
      } else if (role === Role.KITCHEN) {
        router.push('/kitchen');
      } else if (role === Role.DELIVERY) {
        router.push('/delivery');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err?.message || 'رمز الدعوة غير صالح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-2 mx-auto">
              <UserCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">قبول دعوة الانضمام</CardTitle>
            <CardDescription className="text-xs">
              أهلاً بك في منصة شات بايلوت! يرجى تعيين كلمة المرور واسمك لتفعيل حسابك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
              )}

              <Input
                label="الاسم الكامل"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أحمد محمد"
                required
              />

              <Input
                label="كلمة المرور الجديدة"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                required
              />

              <Input
                label="تأكيد كلمة المرور"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                required
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-base font-bold mt-2"
              >
                تفعيل الحساب والدخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
