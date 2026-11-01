'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiDelete, apiGet, apiPost } from '../../../../lib/api';

type Document = {
  id: string;
  title: string;
  branchId: string | null;
  status: string;
  chunkCount: number;
  createdAt: string;
  extractedText: string | null;
};

type SearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
};

export default function CompanyKnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await apiGet<Document[]>('/api/v1/kb/documents'));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل مستندات قاعدة المعرفة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() && !file) {
      setError('أدخل محتوى المستند أو أرفق ملفاً.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let fileId: string | undefined;
      if (file) {
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
          reader.readAsDataURL(file);
        });
        const uploaded = await apiPost<{ id: string }>('/api/v1/files/upload', {
          purpose: 'kb-document',
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
        });
        fileId = uploaded.id;
      }
      await apiPost('/api/v1/kb/documents', { title, content, ...(fileId ? { fileId } : {}) });
      setTitle('');
      setContent('');
      setFile(null);
      await loadDocuments();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر إضافة المستند.');
    } finally {
      setSaving(false);
    }

  }

  async function reprocessDocument(id: string) {
    setError('');
    try {
      await apiPost(`/api/v1/kb/documents/${id}/reprocess`);
      await loadDocuments();
    } catch (reprocessError) {
      setError(reprocessError instanceof ApiError ? reprocessError.message : 'تعذر إعادة فهرسة المستند.');
    }
  }

  async function searchKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      setResults(await apiPost<SearchResult[]>('/api/v1/kb/search', { query, limit: 5 }));
    } catch (searchError) {
      setError(searchError instanceof ApiError ? searchError.message : 'تعذر تنفيذ البحث الدلالي.');
    } finally {
      setSearching(false);
    }
  }

  async function removeDocument(id: string) {
    if (!window.confirm('هل تريد حذف هذا المستند وجميع أجزائه؟')) return;
    setError('');
    try {
      await apiDelete(`/api/v1/kb/documents/${id}`);
      setDocuments((current) => current.filter((document) => document.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'تعذر حذف المستند.');
    }
  }

  return (
    <AppShell title="قاعدة المعرفة والذكاء الاصطناعي" description="أضف سياسات المطعم ومعلوماته ثم اختبر ما سيسترجعه المساعد الذكي.">
      <div className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">اختبار البحث الدلالي</h2>
            <form onSubmit={searchKnowledge} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: ما هي مواعيد التوصيل؟" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button disabled={searching} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{searching ? 'جارٍ البحث...' : 'بحث دلالي'}</button>
            </form>
            {results.length > 0 && <div className="mt-5 space-y-3">{results.map((result) => <article key={result.chunkId} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">{result.title}</h3><span className="text-xs text-slate-500" dir="ltr">score {result.score.toFixed(2)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{result.content}</p></article>)}</div>}
            {!searching && query && results.length === 0 && <p className="mt-5 text-sm text-slate-500">لم يتم العثور على نتائج مطابقة.</p>}
          </section>

          <form onSubmit={createDocument} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">إضافة مستند</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-700">العنوان<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">المحتوى<textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">أو إرفاق ملف<input type="file" accept=".txt,.md,.pdf,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
            <button disabled={saving} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ وفهرسة المستند'}</button>
          </form>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">المستندات المفهرسة</h2></div>
          {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل المستندات...</p> : documents.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد مستندات بعد.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">المستند</th><th className="px-5 py-3">النطاق</th><th className="px-5 py-3">الأجزاء</th><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">الإجراءات</th></tr></thead><tbody className="divide-y divide-slate-100">{documents.map((document) => <tr key={document.id}><td className="px-5 py-4 font-semibold">{document.title}</td><td className="px-5 py-4 text-slate-500">{document.branchId ? 'فرع محدد' : 'كافة الفروع'}</td><td className="px-5 py-4">{document.chunkCount}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{document.status}</span></td><td className="space-x-3 space-x-reverse px-5 py-4"><button onClick={() => void reprocessDocument(document.id)} className="text-xs font-bold text-blue-600 hover:underline">إعادة الفهرسة</button><button onClick={() => void removeDocument(document.id)} className="text-xs font-bold text-rose-600 hover:underline">حذف</button></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </AppShell>
  );
}
