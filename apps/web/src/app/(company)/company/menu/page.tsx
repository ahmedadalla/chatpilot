import React from 'react';

export default function CompanyMenuPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            قائمة الطعام والتصنيفات | Master Menu Catalog
          </h1>
          <p className="text-sm text-slate-500">
            إدارة التصنيفات والوجبات المشتركة لجميع فروع المطعم (Company Admin Scope)
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            + تصنيف جديد
          </button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
            + إضافة وجبة جديدة
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">اسم الوجبة</th>
                <th className="px-4 py-3">التصنيف</th>
                <th className="px-4 py-3">السعر الأساسي</th>
                <th className="px-4 py-3">العملة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">كشري مخصوص (وسط)</td>
                <td className="px-4 py-3 text-slate-600">الأطباق الرئيسية</td>
                <td className="px-4 py-3 font-medium text-slate-900">45.00</td>
                <td className="px-4 py-3 text-slate-500">EGP</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    نشط (متاح)
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  <button className="text-xs text-blue-600 hover:underline">تعديل</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-rose-600 hover:underline">أرشفة</button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">طاجن لحمة مفرومة</td>
                <td className="px-4 py-3 text-slate-600">طواجن الفرن</td>
                <td className="px-4 py-3 font-medium text-slate-900">65.00</td>
                <td className="px-4 py-3 text-slate-500">EGP</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    نشط (متاح)
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2 space-x-reverse">
                  <button className="text-xs text-blue-600 hover:underline">تعديل</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-rose-600 hover:underline">أرشفة</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
