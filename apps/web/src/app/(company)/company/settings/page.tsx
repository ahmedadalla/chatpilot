import React from 'react';

export default function CompanySettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          إعدادات الشركة والمطعم | Company Settings
        </h1>
        <p className="text-sm text-slate-500">
          التهيئة الإقليمية الافتراضية، العملة، والمنطقة الزمنية (قابلة للتعديل وليست ثابتة، Q-REQ-6)
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">الدولة الافتراضية</label>
            <input
              type="text"
              defaultValue="EG (Egypt)"
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">العملة الافتراضية</label>
            <input
              type="text"
              defaultValue="EGP (Egyptian Pound)"
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">المنطقة الزمنية</label>
            <input
              type="text"
              defaultValue="Africa/Cairo"
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">رمز الاتصال الهاتفي</label>
            <input
              type="text"
              defaultValue="+20"
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
