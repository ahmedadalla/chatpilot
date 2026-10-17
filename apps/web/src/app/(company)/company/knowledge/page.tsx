import React from 'react';

export default function CompanyKnowledgeBasePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            قاعدة المعرفة والذكاء الاصطناعي | Knowledge Base (RAG)
          </h1>
          <p className="text-sm text-slate-500">
            إدارة الوثائق، سياسات المطعم، وتغذية بوت واتساب الذكي بالمعلومات الدقيقة (Company Admin Scope)
          </p>
        </div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
          + رفع مستند جديد
        </button>
      </div>

      {/* Semantic Search Tester */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-2">اختبار البحث الدلالي (Live Vector Search)</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="اكتب سؤالاً لاختبار ما سيسترجعه الذكاء الاصطناعي... (مثال: ما هي مواعيد التوصيل؟)"
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-right"
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            بحث دلالي
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">عنوان المستند</th>
                <th className="px-4 py-3">نطاق الفرع</th>
                <th className="px-4 py-3">عدد الأجزاء (Chunks)</th>
                <th className="px-4 py-3">حالة الفهرسة</th>
                <th className="px-4 py-3">تاريخ الإضافة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">سياسة التوصيل ومناطق الخدمة</td>
                <td className="px-4 py-3 text-slate-500">كافة الفروع (عام)</td>
                <td className="px-4 py-3">4 chunks</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    جاهز (READY)
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">2026-10-16</td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  <button className="text-xs text-blue-600 hover:underline">إعادة معالجة</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-rose-600 hover:underline">حذف</button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">قائمة المكونات والحساسية الغذائية</td>
                <td className="px-4 py-3 text-slate-500">كافة الفروع (عام)</td>
                <td className="px-4 py-3">8 chunks</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    جاهز (READY)
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">2026-10-16</td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  <button className="text-xs text-blue-600 hover:underline">إعادة معالجة</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-rose-600 hover:underline">حذف</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
