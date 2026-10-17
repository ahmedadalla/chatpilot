import React from 'react';

export default function PlatformCompaniesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            إدارة الشركات والمطاعم | Companies Directory
          </h1>
          <p className="text-sm text-slate-500">
            نظرة عامة على الشركات المشتركة، الفروع، وخطط الاشتراكات (Super Admin Platform Support)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">اسم الشركة</th>
                <th className="px-4 py-3">المعرف (Slug)</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">عدد الفروع</th>
                <th className="px-4 py-3">المستخدمين</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-medium">تجربة مطعم القاهرة (Demo)</td>
                <td className="px-4 py-3 text-slate-500">cairo-bistro</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    نشط (ACTIVE)
                  </span>
                </td>
                <td className="px-4 py-3">2</td>
                <td className="px-4 py-3">5</td>
                <td className="px-4 py-3">
                  <button className="text-xs text-blue-600 hover:underline">
                    فحص الدعم المنصي (Audited Inspect)
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
