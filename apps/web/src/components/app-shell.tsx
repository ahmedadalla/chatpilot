'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthUser, getStoredUser, logout } from '../lib/auth';
import { MessageKey, useI18n } from '../lib/i18n';

const navItems: Array<{ href: string; label: MessageKey; roles: readonly string[] }> = [
  { href: '/dashboard', label: 'overview', roles: ['*'] },
  {
    href: '/orders',
    label: 'orders',
    roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER', 'KITCHEN', 'DELIVERY', 'STAFF'],
  },
  { href: '/admin/companies', label: 'platformCompanies', roles: ['SUPER_ADMIN'] },
  { href: '/admin/analytics', label: 'platformAnalytics', roles: ['SUPER_ADMIN'] },
  { href: '/billing', label: 'billing', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { href: '/company/branches', label: 'branches', roles: ['COMPANY_ADMIN'] },
  { href: '/company/settings', label: 'companySettings', roles: ['COMPANY_ADMIN'] },
  {
    href: '/company/staff',
    label: 'staff',
    roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER'],
  },
  { href: '/company/menu', label: 'menu', roles: ['COMPANY_ADMIN'] },
  { href: '/company/knowledge', label: 'knowledge', roles: ['COMPANY_ADMIN'] },
  { href: '/company/whatsapp', label: 'whatsapp', roles: ['COMPANY_ADMIN'] },
  {
    href: '/company/analytics',
    label: 'companyAnalytics',
    roles: ['COMPANY_ADMIN'],
  },
  {
    href: '/branch/analytics',
    label: 'branchAnalytics',
    roles: ['BRANCH_MANAGER', 'KITCHEN', 'DELIVERY', 'STAFF'],
  },
  { href: '/branch/settings', label: 'branchSettings', roles: ['BRANCH_MANAGER'] },
  { href: '/branch/menu', label: 'menuAvailability', roles: ['BRANCH_MANAGER'] },
  { href: '/kitchen', label: 'kitchen', roles: ['KITCHEN', 'STAFF', 'BRANCH_MANAGER'] },
  { href: '/delivery', label: 'delivery', roles: ['DELIVERY', 'BRANCH_MANAGER'] },
];

export function AppShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) router.replace('/login');
    else setUser(stored);
  }, [router]);

  if (!user)
    return (
      <main className="grid min-h-screen place-items-center text-slate-500">
        {t('loadingWorkspace')}
      </main>
    );

  const visibleItems = navItems.filter(
    (item) => item.roles.includes('*') || item.roles.includes(user.role),
  );

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden"
            >
              {t('menu')}
            </button>
            <Link href="/dashboard" className="font-black tracking-[0.2em] text-blue-700">
              CHATPILOT
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-left sm:block" dir="ltr">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="language-select" className="sr-only">
                {t('language')}
              </label>
              <select
                id="language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'ar' | 'en')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="ar">{t('arabic')}</option>
                <option value="en">{t('english')}</option>
              </select>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside
          className={`${menuOpen ? 'block' : 'hidden'} absolute inset-x-0 top-16 z-20 border-b border-slate-200 bg-white p-4 lg:static lg:block lg:min-h-[calc(100vh-4rem)] lg:w-64 lg:border-b-0 lg:border-l lg:p-5`}
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('workspace')}
          </p>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-bold text-slate-700">{t('currentRole')}</p>
            <p className="mt-1" dir="ltr">
              {user.role}
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {(title || description) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>}
              {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
