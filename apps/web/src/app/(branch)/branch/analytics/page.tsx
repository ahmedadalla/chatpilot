import React from 'react';

export default function BranchOperationalAnalyticsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          المؤشرات التشغيلية للفرع | Branch Operational Analytics
        </h1>
        <p className="text-sm text-slate-500">
          معدلات سرعة التحضير، أوقات التوصيل، وكفاءة المطبخ (مخصصة للتشغيل — خالية من البيانات المالية، D-14)
        </p>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">الطلبات المكتملة</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">540 طلب</p>
          <span className="text-xs text-emerald-600 mt-1 block">95.4% نسبة التسليم</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">متوسط زمن التحضير بالمطبخ</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">16 دقيقة</p>
          <span className="text-xs text-blue-600 mt-1 block">من القبول حتى جاهز للتسليم</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">متوسط زمن التوصيل</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">22 دقيقة</p>
          <span className="text-xs text-purple-600 mt-1 block">من الخروج حتى التسليم</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">طلبات ملغاة / فشل التوصيل</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">18 طلب</p>
          <span className="text-xs text-slate-400 mt-1 block">3.2% معدل الأعطال التشغيلية</span>
        </div>
      </div>
    </div>
  );
}
