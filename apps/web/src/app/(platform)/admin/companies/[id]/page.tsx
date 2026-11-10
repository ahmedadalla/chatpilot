'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { AppShell } from '../../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../../components/ui/status-badge';
import { Button } from '../../../../../components/ui/button';
import { Textarea } from '../../../../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../../components/ui/card';
import { ErrorState } from '../../../../../components/ui/error-state';
import { formatDate } from '../../../../../lib/utils';
import { ShieldAlert, ArrowRight, GitBranch, Users, ShoppingBag, Lock } from 'lucide-react';

export default function AuditedCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [auditReason, setAuditReason] = React.useState('');
  const [confirmedReason, setConfirmedReason] = React.useState<string | null>(null);
  const [reasonError, setReasonError] = React.useState('');

  const {
    data: company,
    isLoading,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ['platform', 'company', companyId, confirmedReason],
    queryFn: () =>
      api.get<any>(`/api/platform/companies/${companyId}`, {
        params: { reason: confirmedReason || '' },
      }),
    enabled: Boolean(confirmedReason),
    retry: false,
  });

  const handleStartInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditReason.trim()) {
      setReasonError('سبب التدقيق مطلوب ومسجل في سجل التدقيق الأمني (AuditLog)');
      return;
    }
    setReasonError('');
    setConfirmedReason(auditReason.trim());
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/companies')}
            className="h-8 text-xs"
          >
            <ArrowRight className="me-1 h-3.5 w-3.5" />
            العودة للشركات
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              جلسة تدقيق ودعم فني للمستأجر (Audited Support Inspection)
            </h2>
            <p className="text-xs text-slate-500">
              يخضع الوصول إلى بيانات المستأجرين للرقابة والتدقيق الأمني الصارم وفقاً لمعايير D-5
            </p>
          </div>
        </div>

        {!confirmedReason ? (
          <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50/30">
            <CardHeader className="text-start">
              <div className="flex items-center gap-3 text-amber-800 mb-2">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
                <CardTitle className="text-base text-amber-900">
                  تصريح وصول لمرة واحدة لأغراض الدعم الفني
                </CardTitle>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                وفقاً للسياسة الأمنية للمنصة، لا يُسمح بأي قراءة أو فحص لبيانات المستأجر دون تسجيل
                سبب تدقيق إلزامي وموثق في قاعدة البيانات مقترناً بمعرّف حسابك وتوقيت الجلسة.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartInspection} className="space-y-4">
                <Textarea
                  label="سبب التفتيش والتدقيق (إلزامي)"
                  value={auditReason}
                  onChange={(e) => {
                    setAuditReason(e.target.value);
                    if (reasonError) setReasonError('');
                  }}
                  placeholder="مثال: بناءً على تذكرة الدعم الفني رقم #4928 للتحقق من إعدادات الفروع..."
                  error={reasonError}
                  required
                  rows={4}
                />

                <Button
                  type="submit"
                  className="w-full h-10 font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Lock className="me-2 h-4 w-4" />
                  توثيق السبب والبدء في التدقيق
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-semibold">
            جاري فتح الجلسة المدققة وتحميل بيانات الشركة...
          </div>
        ) : error ? (
          <ErrorState message={(error as any)?.message} onRetry={() => refetch()} />
        ) : company ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  @{company.slug} • المعرّف: {company.id}
                </p>
              </div>
              <StatusBadge status={company.status} />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">عدد الفروع</span>
                  <p className="text-xl font-bold text-slate-900">
                    {company.branches?.length || 0}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">إجمالي الموظفين</span>
                  <p className="text-xl font-bold text-slate-900">{company._count?.users || 0}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">إجمالي الطلبات</span>
                  <p className="text-xl font-bold text-slate-900">{company._count?.orders || 0}</p>
                </div>
              </div>
            </div>

            {/* Branches List */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3">فروع الشركة المسجلة</h4>
              {company.branches?.length ? (
                <div className="divide-y divide-slate-100">
                  {company.branches.map((b: any) => (
                    <div key={b.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{b.name}</span>
                        <span className="ms-2 font-mono text-xs text-slate-400">({b.code})</span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b.address || 'لا يوجد عنوان محدد'}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {b.timezone}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">لم يتم تسجيل أي فروع لهذه الشركة بعد.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
