import React from 'react';

export default function DeliveryBoardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            لوحة التوصيل والسائقين | Delivery Board
          </h1>
          <p className="text-sm text-slate-500">
            استلام الطلبات الجاهزة، بدء التوصيل، وتأكيد التسليم (Delivery Portal Only)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-600 font-medium">اتصال مباشر (Live Socket.IO)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: READY_FOR_DELIVERY */}
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-purple-900">طلبات جاهزة للاستلام (READY)</h2>
            <span className="rounded-full bg-purple-200/80 px-2.5 py-0.5 text-xs font-bold text-purple-800">
              1
            </span>
          </div>

          <div className="rounded-lg border border-purple-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900">BR-CAI-20261016-0003</span>
              <span className="font-semibold text-emerald-600">180.00 EGP</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>📍 العنوان: عمارة 14، دجلة المعادي، الدور الثالث</p>
              <p>📞 الهاتف: +201012345678</p>
              <p>💳 الدفع: عند الاستلام (Cash on Delivery)</p>
            </div>
            <div className="pt-2">
              <button className="w-full rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-500">
                بدء التوصيل (Start Delivery)
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: OUT_FOR_DELIVERY */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-emerald-900">جاري التوصيل (OUT_FOR_DELIVERY)</h2>
            <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              1
            </span>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900">BR-CAI-20261016-0004</span>
              <span className="font-semibold text-emerald-600">220.00 EGP</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>📍 العنوان: شارع 9، المعادي</p>
              <p>📞 الهاتف: +201198765432</p>
            </div>
            <div className="pt-2 flex gap-2">
              <button className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500">
                تأكيد التسليم (Mark Delivered)
              </button>
              <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                فشل التوصيل
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
