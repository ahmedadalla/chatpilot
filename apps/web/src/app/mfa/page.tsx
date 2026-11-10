'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api-client';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card';
import { Shield, Key, Copy, Check } from 'lucide-react';

export default function MfaPage() {
  const router = useRouter();

  const [setupData, setSetupData] = React.useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);

  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const handleInitiateSetup = async () => {
    setError('');
    setSetupLoading(true);
    try {
      const data = await api.post<any>('/api/auth/mfa/setup');
      setSetupData(data);
    } catch (err: any) {
      setError(err?.message || 'فشل إعداد المصادقة الثنائية');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/mfa/verify', { code: code.trim() });
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.message || 'رمز التحقق غير صحيح، يرجى إعادة المحاولة');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-2 mx-auto">
              <Shield className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">المصادقة الثنائية (MFA)</CardTitle>
            <CardDescription className="text-xs">
              حسابات إدارة النظام الأساسي (Super Admin) تتطلب مصادقة ثنائية إلزامية لحماية المنصة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
            )}

            {!setupData ? (
              <div className="space-y-4 text-center py-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  إذا لم تكن قد قمت بربط تطبيق المصادقة (Authenticator) بحسابك بعد، فاضغط على الزر
                  أدناه للحصول على المفتاح السري ورموز الاسترداد.
                </p>
                <Button
                  onClick={handleInitiateSetup}
                  loading={setupLoading}
                  className="w-full h-11"
                >
                  <Key className="me-2 h-4 w-4" />
                  تهيئة مفتاح المصادقة الثنائية (Setup MFA)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-1">
                    المفتاح السري (Manual Secret Key):
                  </p>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border font-mono text-xs text-slate-900 break-all select-all">
                    <span>{setupData.secret}</span>
                    <button
                      onClick={handleCopySecret}
                      className="text-slate-500 hover:text-slate-800 p-1"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {setupData.recoveryCodes && (
                  <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200 text-xs">
                    <p className="font-bold text-amber-900 mb-2">
                      رموز الاسترداد للطوارئ (احتفظ بها في مكان آمن):
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-slate-700">
                      {setupData.recoveryCodes.map((code, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-1.5 rounded border border-amber-100 text-center"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4 pt-3 border-t border-slate-100">
              <Input
                label="أدخل رمز التحقق (6 أرقام)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                className="text-center font-mono text-lg tracking-widest"
              />

              <Button type="submit" loading={loading} className="w-full h-11 text-base font-bold">
                تأكيد ومتابعة
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
