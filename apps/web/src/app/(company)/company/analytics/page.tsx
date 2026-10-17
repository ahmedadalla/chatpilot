import React from 'react';

export default function CompanyAnalyticsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          لوحة التحليلات المالية والتشغيلية | Company Financial Analytics
        </h1>
        <p className="text-sm text-slate-500">
          إجمالي الإيرادات، قيمة المبيعات (GMV)، متوسط قيمة الطلب، ومؤشرات الأداء (Company Admin Only)
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">إجمالي المبيعات (GMV)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">145,280.00 EGP</p>
          <span className="inline-flex items-center text-xs text-emerald-600 mt-1 font-medium">
            ↑ 14% مقارنة بالشهر الماضي
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">متوسط قيمة الطلب (AOV)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">168.50 EGP</p>
          <span className="text-xs text-slate-400 mt-1 block">لكل طلب مكتمل</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">الطلبات المسلمة</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">862 طلب</p>
          <span className="text-xs text-emerald-600 mt-1 block">94.2% نسبة النجاح</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">رسوم التوصيل المحصلة</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">21,550.00 EGP</p>
          <span className="text-xs text-slate-400 mt-1 block">فروع القاهرة والإسكندرية</span>
        </div>
      </div>

      {/* Financial Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">تفاصيل المبيعات حسب العملة والفروع</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">العملة</th>
                <th className="px-4 py-3">إجمالي الطلبات</th>
                <th className="px-4 py-3">مبيعات الوجبات</th>
                <th className="px-4 py-3">رسوم التوصيل</th>
                <th className="px-4 py-3">الإجمالي (GMV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold">فرع المعادي</td>
                <td className="px-4 py-3 font-medium text-slate-600">EGP</td>
                <td className="px-4 py-3">540</td>
                <td className="px-4 py-3 font-medium">78,500.00</td>
                <td className="px-4 py-3">13,500.00</td>
                <td className="px-4 py-3 font-bold text-emerald-600">92,000.00 EGP</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">فرع مدينة نصر</td>
                <td className="px-4 py-3 font-medium text-slate-600">EGP</td>
                <td className="px-4 py-3">322</td>
                <td className="px-4 py-3 font-medium">45,230.00</td>
                <td className="px-4 py-3">8,050.00</td>
                <td className="px-4 py-3 font-bold text-emerald-600">53,280.00 EGP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
