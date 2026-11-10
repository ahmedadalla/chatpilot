'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../../components/ui/card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { Dialog } from '../../../../components/ui/dialog';
import { useToast } from '../../../../components/ui/toast';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { WhatsAppProviderType, WhatsAppConnectionStatus } from '@chatpilot/contracts';
import {
  MessageSquare,
  QrCode,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Unplug,
  Phone,
} from 'lucide-react';

export default function CompanyWhatsAppPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [setupModalType, setSetupModalType] = React.useState<WhatsAppProviderType | null>(null);
  const [riskAcknowledged, setRiskAcknowledged] = React.useState(false);
  const [businessConnectionId, setBusinessConnectionId] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [branchId, setBranchId] = React.useState('');

  const [pairingModalData, setPairingModalData] = React.useState<{
    qrDataUri?: string;
    pairingCode?: string;
  } | null>(null);
  const [disconnectTargetId, setDisconnectTargetId] = React.useState<string | null>(null);

  // Queries
  const { data: connections = [], isLoading } = useQuery<any[]>({
    queryKey: ['whatsapp', 'connections'],
    queryFn: () => api.get<any[]>('/api/whatsapp/connections'),
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<any[]>('/api/branches'),
  });

  // Setup Mutation
  const setupMutation = useMutation({
    mutationFn: (data: any) => api.post<any>('/api/whatsapp/connections', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'connections'] });
      setSetupModalType(null);
      setBusinessConnectionId('');
      setPhoneNumber('');
      setRiskAcknowledged(false);

      if (res.qrDataUri || res.pairingCode) {
        setPairingModalData({
          qrDataUri: res.qrDataUri,
          pairingCode: res.pairingCode,
        });
      }
      success('تم بدء تهيئة قناة واتساب بنجاح');
    },
    onError: (err: any) => toastError('فشل تهيئة القناة', err?.message),
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/whatsapp/connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'connections'] });
      setDisconnectTargetId(null);
      success('تم فصل قناة واتساب');
    },
    onError: (err: any) => toastError('فشل فصل القناة', err?.message),
  });

  // Refresh QR Mutation
  const refreshQrMutation = useMutation({
    mutationFn: (id: string) => api.post<any>(`/api/whatsapp/connections/${id}/refresh-qr`),
    onSuccess: (res) => {
      setPairingModalData({
        qrDataUri: res.qrDataUri,
        pairingCode: res.pairingCode,
      });
      success('تم تحديث رمز الاقتران');
    },
    onError: (err: any) => toastError('فشل تحديث الرمز', err?.message),
  });

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupModalType) return;

    setupMutation.mutate({
      provider: setupModalType,
      businessConnectionId: businessConnectionId.trim() || `conn_${Date.now()}`,
      phoneNumber: phoneNumber.trim() || undefined,
      branchId: branchId || undefined,
      riskAcknowledged:
        setupModalType === WhatsAppProviderType.REGULAR_QR_PAIRING ? riskAcknowledged : undefined,
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">قنوات واتساب والربط</h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة قنوات التواصل، ربط الأرقام عبر Meta Cloud API أو مسح رمز QR، وإعدادات توجيه الفروع
          </p>
        </div>

        {/* Existing Connections */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">القنوات المتصلة الحالية</h3>
          {isLoading ? (
            <TableSkeleton rows={2} cols={4} />
          ) : connections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((c: any) => (
                <Card key={c.id} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase text-slate-400">
                        {c.provider}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 mt-2">
                      <Phone className="h-4 w-4 text-emerald-600" />
                      {c.phoneNumber || c.businessConnectionId}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {c.branch
                        ? `مخصص لفرع: ${c.branch.name}`
                        : 'مشترك لكافة فروع الشركة (توجيه هجين)'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between border-t border-slate-100 pt-3">
                    {c.provider === WhatsAppProviderType.REGULAR_QR_PAIRING && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshQrMutation.mutate(c.id)}
                        loading={refreshQrMutation.isPending}
                        className="h-8 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 me-1" />
                        تحديث رمز QR
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisconnectTargetId(c.id)}
                      className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <Unplug className="h-3.5 w-3.5 me-1" />
                      فصل القناة
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-white border border-slate-200">
              <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">لا توجد قنوات واتساب مفعلة حالياً</p>
              <p className="text-xs text-slate-500 mt-1">
                اختر إحدى طرق الربط الثلاث أدناه لبدء استقبال المحادثات.
              </p>
            </div>
          )}
        </div>

        {/* 3 Selectable Onboarding Options */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">
            خيارات الربط المتاحة (Onboarding Options)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Option 1: Meta Cloud API */}
            <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/20">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Meta Cloud API (الرسمي)</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  الخيار الموصى به رسمياً للشركات الكبرى. استقرار 100%، دعم قوالب الرسائل المعتمدة،
                  وسرعة فائقة دون الحاجة لهاتف مفتوح.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={() => setSetupModalType(WhatsAppProviderType.CLOUD_API)}
                  className="w-full text-xs font-semibold"
                >
                  ربط عبر Cloud API
                </Button>
              </CardContent>
            </Card>

            {/* Option 2: Coexistence Mode */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">واتساب للأعمال المشترك</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  نمط Coexistence الرسمي. يتيح استخدام تطبيق WhatsApp Business على الهاتف بجانب
                  المنصة دون انقطاع.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  onClick={() => setSetupModalType(WhatsAppProviderType.COEXISTENCE)}
                  className="w-full text-xs font-semibold"
                >
                  تفعيل Coexistence
                </Button>
              </CardContent>
            </Card>

            {/* Option 3: Regular QR Pairing */}
            <Card className="hover:shadow-md transition-shadow border-amber-200 bg-amber-50/20">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                  <QrCode className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">ربط مباشر برمز QR</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  ربط سريع عبر مسح رمز الاستجابة السريعة مثل واتساب ويب. متاح للتجربة والتكامل
                  السريع مع إقرار المخاطر (Q-REQ-4).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  onClick={() => setSetupModalType(WhatsAppProviderType.REGULAR_QR_PAIRING)}
                  className="w-full text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  بدء مسح رمز QR
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Setup Dialog */}
        <FormDialog
          open={Boolean(setupModalType)}
          onOpenChange={(open) => !open && setSetupModalType(null)}
          title={`إعداد قناة: ${setupModalType || ''}`}
          submitLabel="بدء الاتصال"
          loading={setupMutation.isPending}
          onSubmit={handleSetupSubmit}
        >
          {setupModalType === WhatsAppProviderType.REGULAR_QR_PAIRING && (
            <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900 leading-relaxed mb-3">
              <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                <ShieldAlert className="h-4 w-4" />
                إقرار إخلاء المسؤولية للربط غير الرسمي (Q-REQ-4)
              </div>
              الربط عبر رمز الاستجابة السريعة (Baileys) هو حل غير رسمي ولا يتبع شركة Meta. يتطلب
              بقاء الهاتف متصلاً بالإنترنت بصورة مستمرة وقد يتعرض لتسجيل خروج مفاجئ.
              <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 cursor-pointer font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={riskAcknowledged}
                  onChange={(e) => setRiskAcknowledged(e.target.checked)}
                  required
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                أقر بمعرفتي وموافقتي على شروط الربط عبر رمز الاستجابة السريعة
              </label>
            </div>
          )}

          <Input
            label="معرّف الاتصال / الحساب (Business Identifier)"
            value={businessConnectionId}
            onChange={(e) => setBusinessConnectionId(e.target.value)}
            placeholder="مثال: main_waba_cairo أو رقم الهاتف"
            required
          />

          <Input
            label="رقم هاتف واتساب (بالصيغة الدولية E.164)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+201012345678"
          />

          <Select
            label="تخصيص لفرع محدد (اختياري - افتراضياً لكل الفروع)"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={[
              { label: 'عام لكافة فروع الشركة (توجيه هجين)', value: '' },
              ...branches.map((b: any) => ({ label: `فرع ${b.name} (${b.code})`, value: b.id })),
            ]}
          />
        </FormDialog>

        {/* Pairing Code & QR Modal */}
        <Dialog
          open={Boolean(pairingModalData)}
          onOpenChange={(open) => !open && setPairingModalData(null)}
          title="مسح رمز الاستجابة السريعة (QR Pairing)"
          description="افتح واتساب على هاتفك > الأجهزة المرتبطة > ربط جهاز"
        >
          {pairingModalData && (
            <div className="space-y-4 text-center">
              {pairingModalData.qrDataUri && (
                <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-200 max-w-xs mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pairingModalData.qrDataUri} alt="WhatsApp QR" className="h-48 w-48" />
                </div>
              )}

              {pairingModalData.pairingCode && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 block mb-1">
                    أو أدخل رمز الاقتران المكون من 8 خانات:
                  </span>
                  <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                    {pairingModalData.pairingCode}
                  </span>
                </div>
              )}

              <Button className="w-full mt-2" onClick={() => setPairingModalData(null)}>
                تم المسح والربط
              </Button>
            </div>
          )}
        </Dialog>

        {/* Disconnect Dialog */}
        <ConfirmDialog
          open={Boolean(disconnectTargetId)}
          onOpenChange={(open) => !open && setDisconnectTargetId(null)}
          title="فصل قناة واتساب"
          message="سيؤدي فصل القناة إلى إيقاف تلقي الرسائل والطلبات عبر هذا الرقم فوراً."
          confirmLabel="تأكيد الفصل"
          loading={disconnectMutation.isPending}
          onConfirm={async () => {
            if (disconnectTargetId) {
              await disconnectMutation.mutateAsync(disconnectTargetId);
            }
          }}
        />
      </div>
    </AppShell>
  );
}
