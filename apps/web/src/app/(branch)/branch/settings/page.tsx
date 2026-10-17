import React from 'react';

export default function BranchSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          الإعدادات التشغيلية للفرع | Branch Operational Settings
        </h1>
        <p className="text-sm text-slate-500">
          إدارة رسوم التوصيل، الحد الأدنى للطلب، ومواعيد العمل (Branch Manager Assigned Scope)
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">اسم الفرع</label>
            <input
              type="text"
              defaultValue="فرع المعادي"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">عنوان الفرع</label>
            <input
              type="text"
              defaultValue="شارع النصر، المعادي، القاهرة"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">رسوم التوصيل</label>
            <input
              type="number"
              defaultValue="25"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">الحد الأدنى للطلب</label>
            <input
              type="number"
              defaultValue="100"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
