'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthUser, getStoredUser, logout } from '../lib/auth';

const navItems = [
  { href: '/dashboard', label: 'نظرة عامة', roles: ['*'] },
  { href: '/admin/companies', label: 'الشركات والمنصة', roles: ['SUPER_ADMIN'] },
  { href: '/company/branches', label: 'الفروع', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { href: '/company/staff', label: 'فريق العمل', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/company/menu', label: 'القائمة', roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/company/knowledge', label: 'قاعدة المعرفة', roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/company/analytics', label: 'تحليلات الشركة', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { href: '/branch/analytics', label: 'تحليلات الفرع', roles: ['BRANCH_MANAGER', 'KITCHEN', 'DELIVERY', 'STAFF'] },
  { href: '/kitchen', label: 'لوحة المطبخ', roles: ['KITCHEN', 'STAFF', 'BRANCH_MANAGER'] },
  { href: '/delivery', label: 'لوحة التوصيل', roles: ['DELIVERY', 'BRANCH_MANAGER'] },
];

export function AppShell({ children, title, description }: { children: React.ReactNode; title?: string; description?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) router.replace('/login');
    else setUser(stored);
  }, [router]);

  if (!user) return <main className="grid min-h-screen place-items-center text-slate-500">جارٍ تحميل مساحة العمل...</main>;

  const visibleItems = navItems.filter((item) => item.roles.includes('*') || item.roles.includes(user.role));

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden">القائمة</button>
            <Link href="/dashboard" className="font-black tracking-[0.2em] text-blue-700">CHATPILOT</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-left sm:block" dir="ltr">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">خروج</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className={`${menuOpen ? 'block' : 'hidden'} absolute inset-x-0 top-16 z-20 border-b border-slate-200 bg-white p-4 lg:static lg:block lg:min-h-[calc(100vh-4rem)] lg:w-64 lg:border-b-0 lg:border-l lg:p-5`}>
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">مساحات العمل</p>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{item.label}</Link>;
            })}
          </nav>
          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-bold text-slate-700">الدور الحالي</p>
            <p className="mt-1" dir="ltr">{user.role}</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {(title || description) && <div className="mb-6">{title && <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>}{description && <p className="mt-2 text-sm text-slate-500">{description}</p>}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
