import React from 'react';

export default function CompanyStaffPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            فريق العمل والصلاحيات | Staff Directory
          </h1>
          <p className="text-sm text-slate-500">
            إدارة صلاحيات المستخدمين، الفروع المعينة، ودعوة موظفين جدد (Company Admin Scope)
          </p>
        </div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
          + دعوة موظف جديد
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">البريد الإلكتروني</th>
                <th className="px-4 py-3">الدور (Role)</th>
                <th className="px-4 py-3">الفرع المعين</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">أحمد محمود</td>
                <td className="px-4 py-3 text-slate-500">ahmed@bistro.eg</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                    مدير شركة (COMPANY_ADMIN)
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">كافة الفروع</td>
                <td className="px-4 py-3 text-emerald-600 font-medium">نشط</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-400">آخر مسؤول (محمي)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
