'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { useToast } from '../../../../components/ui/toast';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { Building, Globe2, ShieldCheck } from 'lucide-react';

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const companyId = user?.companyId;

  const [currency, setCurrency] = React.useState('EGP');
  const [countryCode, setCountryCode] = React.useState('EG');
  const [timezone, setTimezone] = React.useState('Africa/Cairo');
  const [locale, setLocale] = React.useState('ar-EG');
  const [callingCode, setCallingCode] = React.useState('+20');

  const { data: company, isLoading } = useQuery<any>({
    queryKey: ['company', companyId],
    queryFn: () => api.get<any>(`/api/companies/${companyId}`),
    enabled: Boolean(companyId),
  });

  React.useEffect(() => {
    if (company?.settings) {
      setCurrency(company.settings.defaultCurrency || 'EGP');
      setCountryCode(company.settings.countryCode || 'EG');
      setTimezone(company.settings.defaultTimezone || 'Africa/Cairo');
      setLocale(company.settings.defaultLocale || 'ar-EG');
      setCallingCode(company.settings.defaultCallingCode || '+20');
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/api/companies/${companyId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      success('تم حفظ إعدادات الشركة بنجاح');
    },
    onError: (err: any) => toastError('فشل حفظ الإعدادات', err?.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      defaultCurrency: currency,
      countryCode,
      defaultTimezone: timezone,
      defaultLocale: locale,
      defaultCallingCode: callingCode,
    });
  };

  if (isLoading) {
    return (
      <AppShell>
        <TableSkeleton rows={3} cols={2} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            إعدادات الشركة والمطعم
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الهوية التشغيلية، العملة الافتراضية، المناطق الزمنية، وإعدادات الاتصال الإقليمية
            (Q-REQ-6)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Building className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">بيانات المطعم الأساسية</CardTitle>
              </div>
              <CardDescription className="text-xs">
                اسم الشركة والمعرّف المسجل في المنصة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="اسم المطعم / الشركة"
                  value={company?.name || ''}
                  disabled
                  className="bg-slate-50 font-bold"
                />
                <Input
                  label="المعرّف (Slug)"
                  value={company?.slug || ''}
                  disabled
                  className="bg-slate-50 font-mono"
                />
              </div>
            </CardContent>
          </Card>

          {/* Regional & Localization Settings Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Globe2 className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  الإعدادات الإقليمية والعملة (Localization)
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                تطبق هذه الإعدادات كقيم افتراضية لجميع الفروع والطلبات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="العملة الرسمية للمبيعات"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  options={[
                    { label: 'جنيه مصري (EGP)', value: 'EGP' },
                    { label: 'دولار أمريكي (USD)', value: 'USD' },
                    { label: 'ريال سعودي (SAR)', value: 'SAR' },
                    { label: 'درهم إماراتي (AED)', value: 'AED' },
                  ]}
                />

                <Select
                  label="المنطقة الزمنية الافتراضية"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  options={[
                    { label: 'القاهرة (Africa/Cairo)', value: 'Africa/Cairo' },
                    { label: 'الرياض (Asia/Riyadh)', value: 'Asia/Riyadh' },
                    { label: 'دبي (Asia/Dubai)', value: 'Asia/Dubai' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="رمز الدولة (ISO)"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="EG"
                  required
                />
                <Input
                  label="رمز الاتصال الدولي"
                  value={callingCode}
                  onChange={(e) => setCallingCode(e.target.value)}
                  placeholder="+20"
                  required
                />
                <Select
                  label="اللغة الافتراضية"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  options={[
                    { label: 'العربية (ar-EG)', value: 'ar-EG' },
                    { label: 'English (en-US)', value: 'en-US' },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            loading={saveMutation.isPending}
            className="h-11 px-8 font-bold text-base shadow-sm"
          >
            <ShieldCheck className="me-2 h-4 w-4" />
            حفظ إعدادات المطعم
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
