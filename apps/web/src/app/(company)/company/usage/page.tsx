'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../../components/ui/card';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../components/ui/error-state';
import { formatDate } from '../../../../lib/utils';
import { CreditCard, ShoppingBag, MessageSquare, BookOpen, CheckCircle } from 'lucide-react';

export default function CompanyUsagePage() {
  const { user } = useAuth();
  const companyId = user?.companyId;

  const {
    data: usage,
    isLoading,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ['billing', 'usage', companyId],
    queryFn: () => api.get<any>(`/api/billing/usage/${companyId}`),
    enabled: Boolean(companyId),
  });

  if (isLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={3} cols={2} />
      </AppShell>
    );
  }

  if (error || !usage) {
    return (
      <AppShell>
        <ErrorState onRetry={() => refetch()} />
      </AppShell>
    );
  }

  const { subscription, usage: currentUsage } = usage;
  const plan = subscription?.plan;
  const limits = plan?.limits || {};

  const orderLimit = limits.maxOrders || 5000;
  const orderUsed = currentUsage?.order_created || 0;
  const orderPercent = Math.min(Math.round((orderUsed / orderLimit) * 100), 100);

  const messageLimit = limits.maxMessages || 10000;
  const messageUsed = currentUsage?.message_sent || 0;
  const messagePercent = Math.min(Math.round((messageUsed / messageLimit) * 100), 100);

  const docLimit = limits.maxKbDocs || 50;
  const docUsed = currentUsage?.kb_doc || 0;
  const docPercent = Math.min(Math.round((docUsed / docLimit) * 100), 100);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            الاستهلاك وحدود الاشتراك
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة حدود باقة SaaS المفعلة لشركتك، استهلاك الطلبات والرسائل، وتواريخ التجديد
          </p>
        </div>

        {/* Current Plan Overview Card */}
        <Card className="border-emerald-200 bg-emerald-50/20 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                {plan?.code || 'ACTIVE_PLAN'}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                اشتراك فعال
              </div>
            </div>
            <CardTitle className="text-xl font-bold mt-2">
              {plan?.name || 'الباقة الاحترافية'}
            </CardTitle>
            <CardDescription className="text-xs">
              تاريخ نهاية الفترة الحالية:{' '}
              {subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'مفتوح'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Usage Progress Meters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Orders Meter */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold">{orderPercent}%</span>
              </div>
              <CardTitle className="text-sm font-bold">الطلبات المنفذة هذا الشهر</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-slate-900">
                {orderUsed}{' '}
                <span className="text-xs font-normal text-slate-400">/ {orderLimit}</span>
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${orderPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Messages Meter */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold">{messagePercent}%</span>
              </div>
              <CardTitle className="text-sm font-bold">رسائل واتساب المعالجة</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-slate-900">
                {messageUsed}{' '}
                <span className="text-xs font-normal text-slate-400">/ {messageLimit}</span>
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${messagePercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* KB Documents Meter */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <BookOpen className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-bold">{docPercent}%</span>
              </div>
              <CardTitle className="text-sm font-bold">مستندات قاعدة المعرفة</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-slate-900">
                {docUsed} <span className="text-xs font-normal text-slate-400">/ {docLimit}</span>
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${docPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
