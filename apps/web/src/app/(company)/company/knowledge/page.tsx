'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { useToast } from '../../../../components/ui/toast';
import { formatDate } from '../../../../lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, RefreshCw, Trash2, BookOpen, Sparkles } from 'lucide-react';

interface KbDoc {
  id: string;
  title: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  branchId: string | null;
  extractedText: string | null;
  createdAt: string;
  branch?: {
    name: string;
    code: string;
  } | null;
}

export default function CompanyKnowledgeBasePage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  // Upload Form State
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [targetBranchId, setTargetBranchId] = React.useState('');

  // Semantic Search Tester State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = React.useState(false);

  // Queries
  const { data: documents = [], isLoading } = useQuery<KbDoc[]>({
    queryKey: ['kb', 'documents'],
    queryFn: () => api.get<KbDoc[]>('/api/kb/documents'),
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<any[]>('/api/branches'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/kb/documents', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'documents'] });
      setCreateOpen(false);
      setTitle('');
      setContent('');
      success('تم رفع المستند وبدء التقطيع والتضمين الدلالي (Embedding)');
    },
    onError: (err: any) => toastError('فشل رفع المستند', err?.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/kb/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'documents'] });
      setDeleteTargetId(null);
      success('تم حذف المستند ومقاطعه بالكامل');
    },
    onError: (err: any) => toastError('فشل الحذف', err?.message),
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/kb/documents/${id}/reprocess`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'documents'] });
      success('تمت إعادة جدولة استخراج ومعالجة المستند');
    },
    onError: (err: any) => toastError('فشل إعادة المعالجة', err?.message),
  });

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const results = await api.post<any[]>('/api/kb/search', {
        query: searchQuery.trim(),
        limit: 5,
      });
      setSearchResults(results);
    } catch (err: any) {
      toastError('فشل البحث الدلالي', err?.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const columns: ColumnDef<KbDoc>[] = [
    {
      accessorKey: 'title',
      header: 'عنوان المستند',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-900">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'حالة المعالجة',
      cell: ({ row }) => {
        const s = row.original.status;
        const variants: Record<string, 'default' | 'warning' | 'destructive' | 'secondary'> = {
          READY: 'default',
          PROCESSING: 'warning',
          PENDING: 'secondary',
          FAILED: 'destructive',
        };
        const labels: Record<string, string> = {
          READY: 'جاهز للاسترجاع (Ready)',
          PROCESSING: 'جاري المعالجة...',
          PENDING: 'قيد الانتظار',
          FAILED: 'فشل التضمين',
        };
        return <Badge variant={variants[s]}>{labels[s] || s}</Badge>;
      },
    },
    {
      accessorKey: 'branchId',
      header: 'النطاق (Scope)',
      cell: ({ row }) => {
        const b = row.original.branch;
        if (!b)
          return (
            <span className="text-xs text-slate-500 font-semibold">شامل للشركة (كل الفروع)</span>
          );
        return (
          <span className="text-xs text-slate-700 font-semibold">
            {b.name} ({b.code})
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'تاريخ الإضافة',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprocessMutation.mutate(doc.id)}
              loading={reprocessMutation.isPending}
              className="h-8 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 me-1 text-slate-500" />
              إعادة معالجة
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTargetId(doc.id)}
              className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            قاعدة المعرفة والذكاء التوليدي (RAG)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مستندات سياسات المطعم، شروط الخدمة، وإجابات الأسئلة الشائعة المستخدمة في الرد الذكي على
            محادثات واتساب
          </p>
        </div>

        {/* Semantic Search Tester Widget */}
        <Card className="border-emerald-200 bg-emerald-50/20 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base font-bold">
                مختبر البحث الدلالي (Semantic Search Tester)
              </CardTitle>
            </div>
            <p className="text-xs text-slate-500">
              اختبر استرجاع مقاطع المعرفة عبر المتجهات الرياضية (pgvector HNSW) وتأكد من دقة
              المعلومات المسترجعة للرد على العملاء
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اكتب سؤالاً، مثلاً: ما هي مواعيد التوصيل، أو هل تتوفر خيارات نباتية؟"
                className="flex-1 bg-white h-10"
              />
              <Button type="submit" loading={searchLoading} className="h-10 px-6 font-semibold">
                <Search className="me-1.5 h-4 w-4" />
                بحث دلالي
              </Button>
            </form>

            {searchResults && (
              <div className="mt-3 space-y-2 pt-3 border-t border-emerald-100">
                <p className="text-xs font-bold text-slate-700">
                  النتائج المسترجعة ({searchResults.length}):
                </p>
                {searchResults.length > 0 ? (
                  searchResults.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="font-bold text-emerald-700">مقطع #{idx + 1}</span>
                        {res.similarity && (
                          <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                            درجة التطابق: {(res.similarity * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 leading-relaxed font-sans">
                        {res.content || res.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    لم يتم العثور على أي مقاطع معرفية تطابق هذا الاستفسار.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Table */}
        <DataTable
          columns={columns}
          data={documents}
          loading={isLoading}
          searchPlaceholder="بحث في عناوين المستندات..."
          emptyTitle="لا توجد مستندات مسجلة"
          emptyDescription="قم برفع أول مستند معرفي لتزويد الذكاء الاصطناعي بمعلومات مطعمك."
          headerAction={
            <Button onClick={() => setCreateOpen(true)} className="h-9 font-semibold text-xs">
              <Plus className="me-1.5 h-4 w-4" />
              إضافة مستند جديد
            </Button>
          }
        />

        {/* Add Document Modal */}
        <FormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="إضافة مستند معرفي جديد"
          description="سيتم استخراج النص وتقطيعه وتوليد التضمينات الشعاعية تلقائياً"
          submitLabel="حفظ المستند ومعالجته"
          loading={createMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              title: title.trim(),
              extractedText: content.trim(),
              branchId: targetBranchId || undefined,
            });
          }}
        >
          <Input
            label="عنوان المستند"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: سياسة التوصيل وأوقات العمل"
            required
          />

          <Select
            label="نطاق التخصيص (Scope)"
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
            options={[
              { label: 'عام لكافة فروع الشركة', value: '' },
              ...branches.map((b: any) => ({ label: `فرع ${b.name} (${b.code})`, value: b.id })),
            ]}
          />

          <Textarea
            label="نص ومحتوى المستند المعرفي"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="اكتب أو الصق نص المستند والتعليمات هنا..."
            rows={6}
            required
          />
        </FormDialog>

        {/* Delete Confirm */}
        <ConfirmDialog
          open={Boolean(deleteTargetId)}
          onOpenChange={(open) => !open && setDeleteTargetId(null)}
          title="حذف المستند المعرفي"
          message="سيؤدي حذف المستند إلى إزالة كافة المقاطع والتضمينات المرتبطة به نهائياً من قاعدة المتجهات."
          confirmLabel="تأكيد الحذف"
          loading={deleteMutation.isPending}
          onConfirm={async () => {
            if (deleteTargetId) {
              await deleteMutation.mutateAsync(deleteTargetId);
            }
          }}
        />
      </div>
    </AppShell>
  );
}
