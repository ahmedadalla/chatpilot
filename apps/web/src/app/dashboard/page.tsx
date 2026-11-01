'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthUser, clearAuth, getStoredUser, logout } from '../../lib/auth';

const roleLinks = [
  { href: '/admin/companies', label: 'إدارة الشركات', detail: 'Platform administration', roles: ['SUPER_ADMIN'] },
  { href: '/company/branches', label: 'الفروع', detail: 'Branches and operations', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { href: '/company/staff', label: 'فريق العمل', detail: 'Staff and permissions', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { href: '/company/menu', label: 'القائمة', detail: 'Menu and availability', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/company/analytics', label: 'التحليلات', detail: 'Operational insights', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/kitchen', label: 'لوحة المطبخ', detail: 'Kitchen order board', roles: ['KITCHEN', 'BRANCH_MANAGER'] },
  { href: '/delivery', label: 'لوحة التوصيل', detail: 'Delivery order board', roles: ['DELIVERY', 'BRANCH_MANAGER'] },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.replace('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  if (!user) {
    return <main className="grid min-h-screen place-items-center text-slate-500">جارٍ تحميل لوحة التحكم...</main>;
  }

  const visibleLinks = roleLinks.filter((link) => link.roles.includes(user.role));

  async function handleLogout() {
    await logout();
    clearAuth();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-blue-600">CHATPILOT</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">لوحة التحكم</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-left sm:block" dir="ltr">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="rounded-3xl bg-gradient-to-l from-blue-700 to-indigo-900 p-8 text-white shadow-lg">
          <p className="text-sm text-blue-100">مرحباً، {user.name}</p>
          <h2 className="mt-2 text-3xl font-bold">اختر مساحة العمل المناسبة لك</h2>
          <p className="mt-3 max-w-2xl text-blue-100">
            صلاحياتك الحالية: <span className="font-semibold">{user.role}</span>. يمكنك الوصول فقط إلى المساحات المسموحة لدورك.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-bold text-slate-950">{link.label}</h3>
                <span className="text-xl text-blue-600 transition group-hover:-translate-x-1">←</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{link.detail}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
