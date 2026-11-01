'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../../components/app-shell';
import { ApiError, apiDelete, apiGet, apiPost } from '../../../../lib/api';
import { Role } from '@chatpilot/contracts';

type StaffMember = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  isVerified: boolean;
};

const roles = [Role.COMPANY_ADMIN, Role.BRANCH_MANAGER, Role.KITCHEN, Role.DELIVERY, Role.STAFF] as const;

export default function CompanyStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: Role.STAFF, branchId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await apiGet<StaffMember[]>('/api/v1/staff'));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : loadError instanceof Error ? loadError.message : 'تعذر تحميل فريق العمل.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/v1/staff/invite', {
        email: form.email,
        role: form.role,
        ...(form.branchId ? { branchId: form.branchId } : {}),
      });
      setForm({ email: '', role: Role.STAFF, branchId: '' });
      setFormOpen(false);
      setNotice('تم إنشاء الدعوة بنجاح.');
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'تعذر إنشاء الدعوة.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(member: StaffMember) {
    if (!window.confirm(`هل تريد تعطيل ${member.email}؟`)) return;
    try {
      await apiDelete(`/api/v1/staff/${member.id}`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'تعذر تعطيل الحساب.');
    }
  }

  return (
    <AppShell title="فريق العمل والصلاحيات" description="عرض الحسابات النشطة ودعوة أعضاء جدد ضمن نطاق الشركة أو الفرع.">
      <div className="space-y-5">
        <div className="flex justify-end"><button type="button" onClick={() => setFormOpen((open) => !open)} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">{formOpen ? 'إغلاق النموذج' : '+ دعوة موظف جديد'}</button></div>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
        {formOpen && <form onSubmit={invite} className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">البريد الإلكتروني<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" dir="ltr" /></label><label className="text-sm font-semibold">الدور<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as typeof form.role })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" dir="ltr">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><button disabled={saving} className="self-end rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'إرسال الدعوة'}</button></form>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل الفريق...</p> : staff.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد حسابات في هذا النطاق.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">الاسم</th><th className="px-5 py-3">البريد</th><th className="px-5 py-3">الدور</th><th className="px-5 py-3">الفرع</th><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">الإجراء</th></tr></thead><tbody className="divide-y divide-slate-100">{staff.map((member) => <tr key={member.id}><td className="px-5 py-4 font-semibold">{member.name || '—'}</td><td className="px-5 py-4" dir="ltr">{member.email}</td><td className="px-5 py-4"><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700" dir="ltr">{member.role}</span></td><td className="px-5 py-4 text-slate-500">{member.branchName || 'كافة الفروع'}</td><td className="px-5 py-4">{member.isActive ? <span className="text-emerald-600">نشط</span> : <span className="text-slate-400">معطل</span>}</td><td className="px-5 py-4">{member.isActive && <button type="button" onClick={() => void deactivate(member)} className="text-xs font-bold text-rose-600 hover:underline">تعطيل</button>}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </AppShell>
  );
}
