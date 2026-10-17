import React from 'react';

export default function KitchenBoardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            لوحة المطبخ واستلام الطلبات | Kitchen Order Board
          </h1>
          <p className="text-sm text-slate-500">
            متابعة الطلبات الجديدة، التحضير، وتجهيز الوجبات للتوصيل (Kitchen & Staff Portal)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-600 font-medium">اتصال مباشر (Live Socket.IO)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: PENDING (New Orders) */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-amber-900">طلبات جديدة (PENDING)</h2>
            <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              1
            </span>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900">BR-CAI-20261016-0001</span>
              <span className="text-xs text-slate-400">منذ دقيقتين</span>
            </div>
            <ul className="text-xs text-slate-700 space-y-1 divide-y divide-slate-100">
              <li className="pt-1 flex justify-between">
                <span>2x كشري مخصوص (وسط)</span>
                <span className="font-medium">90 EGP</span>
              </li>
              <li className="pt-1 flex justify-between">
                <span>1x طاجن لحمة مفرومة</span>
                <span className="font-medium">65 EGP</span>
              </li>
            </ul>
            <div className="pt-2 flex gap-2">
              <button className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500">
                قبول الطلب (Accept)
              </button>
              <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                رفض
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: IN_PREPARATION */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-blue-900">قيد التحضير (IN_PREPARATION)</h2>
            <span className="rounded-full bg-blue-200/80 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              1
            </span>
          </div>

          <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900">BR-CAI-20261016-0002</span>
              <span className="text-xs text-slate-400">منذ 8 دقائق</span>
            </div>
            <p className="text-xs text-slate-600">3x ساندوتش حواوشي بلدي</p>
            <div className="pt-2">
              <button className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">
                جاهز للتسليم (Mark Ready)
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: READY_FOR_DELIVERY */}
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-purple-900">جاهز للتوصيل (READY)</h2>
            <span className="rounded-full bg-purple-200/80 px-2.5 py-0.5 text-xs font-bold text-purple-800">
              0
            </span>
          </div>
          <div className="text-center py-8 text-xs text-slate-400">
            لا توجد طلبات جاهزة بانتظار مندوب التوصيل
          </div>
        </div>
      </div>
    </div>
  );
}
