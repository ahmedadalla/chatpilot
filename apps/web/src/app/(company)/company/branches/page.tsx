import React from 'react';

export default function CompanyBranchesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            فروع الشركة | Branches Management
          </h1>
          <p className="text-sm text-slate-500">
            إدارة فروع المطعم، الإعدادات التشغيلية، ومواعيد العمل (Company Admin Only)
          </p>
        </div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
          + إضافة فرع جديد
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">رمز الفرع</th>
                <th className="px-4 py-3">اسم الفرع</th>
                <th className="px-4 py-3">المنطقة الزمنية</th>
                <th className="px-4 py-3">رسوم التوصيل</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">CAI-01</td>
                <td className="px-4 py-3">فرع المعادي</td>
                <td className="px-4 py-3 text-slate-500">Africa/Cairo</td>
                <td className="px-4 py-3">25.00 EGP</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    مفتوح للتشغيل
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  <button className="text-xs text-blue-600 hover:underline">
                    الإعدادات التشغيلية
                  </button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-amber-600 hover:underline">
                    تعديل المنطقة الزمنية (تدقيق)
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
