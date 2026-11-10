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
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { useToast } from '../../../../components/ui/toast';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { AiConfigResponseDto } from '@chatpilot/contracts';
import { Bot, Key, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export default function CompanyAiSettingsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [provider, setProvider] = React.useState('gemini');
  const [model, setModel] = React.useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('');

  const { data: config, isLoading } = useQuery<AiConfigResponseDto>({
    queryKey: ['ai', 'config'],
    queryFn: () => api.get<AiConfigResponseDto>('/api/ai/config'),
  });

  React.useEffect(() => {
    if (config) {
      setProvider(config.provider || 'gemini');
      setModel(config.model || 'gemini-1.5-flash');
      setSystemPrompt(config.systemPromptTemplate || '');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch<AiConfigResponseDto>('/api/ai/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'config'] });
      setApiKey('');
      success('تم حفظ إعدادات محرك الذكاء الاصطناعي بنجاح وتشفير المفتاح السري');
    },
    onError: (err: any) => toastError('فشل حفظ الإعدادات', err?.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      provider,
      model,
      systemPromptTemplate: systemPrompt,
      apiKey: apiKey.trim() || undefined,
    });
  };

  const modelOptions: Record<string, Array<{ label: string; value: string }>> = {
    gemini: [
      { label: 'Google Gemini 1.5 Flash (سريع وموصى به)', value: 'gemini-1.5-flash' },
      { label: 'Google Gemini 1.5 Pro (أعلى دقة)', value: 'gemini-1.5-pro' },
    ],
    openai: [
      { label: 'OpenAI GPT-4o-mini (متوازن واقتصادي)', value: 'gpt-4o-mini' },
      { label: 'OpenAI GPT-4o (المتقدم)', value: 'gpt-4o' },
    ],
    openrouter: [
      { label: 'OpenRouter / Claude 3.5 Haiku', value: 'anthropic/claude-3-5-haiku' },
      { label: 'OpenRouter / Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' },
    ],
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            إعدادات محرك الذكاء الاصطناعي (AI)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            اختيار مزود الذكاء الاصطناعي، طراز النموذج، إدارة المفاتيح المشفرة، وضبط تعليمات الرد
            الآلي لمحادثات واتساب
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {/* Provider Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Bot className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">اختيار المزود والنموذج</CardTitle>
              </div>
              <CardDescription className="text-xs">
                حدد مزود الذكاء الاصطناعي الأنسب لمطعمك
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="مزود الخدمة (AI Provider)"
                  value={provider}
                  onChange={(e) => {
                    const newProv = e.target.value;
                    setProvider(newProv);
                    setModel(modelOptions[newProv]?.[0]?.value || '');
                  }}
                  options={[
                    { label: 'Google Gemini', value: 'gemini' },
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'OpenRouter (نماذج متعددة)', value: 'openrouter' },
                  ]}
                />

                <Select
                  label="طراز النموذج (Model)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  options={modelOptions[provider] || []}
                />
              </div>

              {/* API Key field */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    مفتاح API السري للمزود
                  </label>
                  {config?.hasApiKey ? (
                    <Badge variant="success" className="text-[11px] gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      المفتاح مفعل ومشفر بأمان (Envelope-Encrypted)
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[11px]">
                      لم يتم تعيين مفتاح خاص بعد
                    </Badge>
                  )}
                </div>

                <div className="relative">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      config?.hasApiKey
                        ? '•••••••••••••••••••••••• (أدخل قيمة جديدة للاستبدال)'
                        : 'AIzaSy... أو sk-proj-...'
                    }
                    className="ps-9 font-mono text-xs"
                  />
                  <Key className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400">
                  يتم تشفير المفتاح السري باستخدام AES-256-GCM قبل حفظه في قاعدة البيانات ولا يتم
                  إرساله إطلاقاً لمتصفح المستخدم (D-19).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Prompt Template Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  قالب التعليمات البرمجية للنظام (System Prompt)
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                توجيه نبرة المحادثة، الترحيب، وقواعد اقتراح الأصناف والرد على العملاء
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="أنت النادل الذكي لمطعمنا على واتساب. مهمتك مساعدة العملاء بلباقة، توضيح قائمة الأصناف، وتجميع الطلب والتأكيد..."
                rows={7}
                className="font-mono text-xs leading-relaxed"
              />

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                <p className="font-bold text-slate-800 mb-1">المتغيرات الديناميكية المدعومة:</p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <code className="bg-white px-2 py-0.5 rounded border">
                    {'{{restaurant_name}}'}
                  </code>
                  <code className="bg-white px-2 py-0.5 rounded border">{'{{menu_summary}}'}</code>
                  <code className="bg-white px-2 py-0.5 rounded border">{'{{branch_name}}'}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            loading={saveMutation.isPending}
            className="h-11 px-8 font-bold text-base shadow-sm"
          >
            <ShieldCheck className="me-2 h-4 w-4" />
            حفظ إعدادات الذكاء الاصطناعي
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
