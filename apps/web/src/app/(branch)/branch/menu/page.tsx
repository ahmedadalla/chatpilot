import React from 'react';

export default function BranchMenuAvailabilityPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          إتاحة الوجبات بالفرع | Branch Menu Availability & Overrides
        </h1>
        <p className="text-sm text-slate-500">
          تفعيل أو إيقاف الوجبات بفرع المعادي وتعديل أسعار التوصيل الخاصة بالفرع (Branch Manager Scope)
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">الوجبة</th>
                <th className="px-4 py-3">السعر الافتراضي</th>
                <th className="px-4 py-3">سعر الفرع (Override)</th>
                <th className="px-4 py-3">حالة الإتاحة بالفرع</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">كشري مخصوص (وسط)</td>
                <td className="px-4 py-3 text-slate-500">45.00 EGP</td>
                <td className="px-4 py-3 font-medium text-slate-900">— (السعر الافتراضي)</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    متاح للطلب
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-amber-600 hover:underline">
                    تعديل الإتاحة / السعر
                  </button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">طاجن لحمة مفرومة</td>
                <td className="px-4 py-3 text-slate-500">65.00 EGP</td>
                <td className="px-4 py-3 font-medium text-emerald-600">70.00 EGP (معدل)</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                    غير متوفر مؤقتاً
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-blue-600 hover:underline">
                    تفعيل الإتاحة
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
