'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import { useLocale } from '../../providers/locale-provider';
import { useSocket } from '../../providers/socket-provider';
import { Role } from '@chatpilot/contracts';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  UtensilsCrossed,
  Users,
  ShoppingBag,
  ChefHat,
  Bike,
  MessageSquare,
  BookOpen,
  Bot,
  BarChart3,
  Settings,
  CreditCard,
  ScrollText,
  LogOut,
  Globe,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/status-badge';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const allNavItems: NavItem[] = [
  // SUPER_ADMIN
  {
    label: 'لوحة التحكم',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: [Role.SUPER_ADMIN],
  },
  {
    label: 'الشركات والمطاعم',
    href: '/admin/companies',
    icon: Building2,
    roles: [Role.SUPER_ADMIN],
  },
  {
    label: 'الباقات والاشتراكات',
    href: '/admin/plans',
    icon: CreditCard,
    roles: [Role.SUPER_ADMIN],
  },
  {
    label: 'سجل تدقيق النظام',
    href: '/admin/audit-logs',
    icon: ScrollText,
    roles: [Role.SUPER_ADMIN],
  },
  { label: 'تحليلات المنصة', href: '/admin/analytics', icon: BarChart3, roles: [Role.SUPER_ADMIN] },

  // COMPANY_ADMIN
  {
    label: 'لوحة التحكم',
    href: '/company/dashboard',
    icon: LayoutDashboard,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'الفروع والتشغيل',
    href: '/company/branches',
    icon: GitBranch,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'قائمة الطعام',
    href: '/company/menu',
    icon: UtensilsCrossed,
    roles: [Role.COMPANY_ADMIN],
  },
  { label: 'طاقم العمل', href: '/company/staff', icon: Users, roles: [Role.COMPANY_ADMIN] },
  { label: 'سجل الطلبات', href: '/company/orders', icon: ShoppingBag, roles: [Role.COMPANY_ADMIN] },
  {
    label: 'قنوات واتساب',
    href: '/company/whatsapp',
    icon: MessageSquare,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'قاعدة المعرفة',
    href: '/company/knowledge',
    icon: BookOpen,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'إعدادات الذكاء الاصطناعي',
    href: '/company/ai-settings',
    icon: Bot,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'التحليلات والمبيعات',
    href: '/company/analytics',
    icon: BarChart3,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'الإعدادات العامة',
    href: '/company/settings',
    icon: Settings,
    roles: [Role.COMPANY_ADMIN],
  },
  {
    label: 'الاستهلاك والاشتراك',
    href: '/company/usage',
    icon: CreditCard,
    roles: [Role.COMPANY_ADMIN],
  },

  // BRANCH_MANAGER
  {
    label: 'لوحة الفرع',
    href: '/branch/dashboard',
    icon: LayoutDashboard,
    roles: [Role.BRANCH_MANAGER],
  },
  { label: 'طلبات الفرع', href: '/branch/orders', icon: ShoppingBag, roles: [Role.BRANCH_MANAGER] },
  {
    label: 'مراقبة المطبخ',
    href: '/branch/kitchen-monitor',
    icon: ChefHat,
    roles: [Role.BRANCH_MANAGER],
  },
  {
    label: 'مراقبة التوصيل',
    href: '/branch/delivery-monitor',
    icon: Bike,
    roles: [Role.BRANCH_MANAGER],
  },
  { label: 'موظفو الفرع', href: '/branch/staff', icon: Users, roles: [Role.BRANCH_MANAGER] },
  {
    label: 'توفر القائمة',
    href: '/branch/menu',
    icon: UtensilsCrossed,
    roles: [Role.BRANCH_MANAGER],
  },
  {
    label: 'تحليلات الفرع',
    href: '/branch/analytics',
    icon: BarChart3,
    roles: [Role.BRANCH_MANAGER],
  },
  {
    label: 'إعدادات الفرع',
    href: '/branch/settings',
    icon: Settings,
    roles: [Role.BRANCH_MANAGER],
  },

  // KITCHEN
  { label: 'شاشة المطبخ', href: '/kitchen', icon: ChefHat, roles: [Role.KITCHEN] },

  // STAFF
  { label: 'استقبال الطلبات', href: '/staff', icon: ShoppingBag, roles: [Role.STAFF] },

  // DELIVERY
  { label: 'شاشة التوصيل', href: '/delivery', icon: Bike, roles: [Role.DELIVERY] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, logout, isAuthenticated, isLoading } = useAuth();
  const { locale, toggleLocale } = useLocale();
  const { status: socketStatus } = useSocket();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Redirect to login if unauthenticated once loading finished
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">جاري تحميل النظام...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const currentRole = role || Role.STAFF;
  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-white border-e border-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-xl shadow-xs">
              CP
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base">ChatPilot</span>
              <p className="text-xs text-slate-400 font-medium">شات بايلوت</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Scope Info */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
              {user.name}
            </span>
            <StatusBadge status={user.role} locale={locale} />
          </div>
          {user.company && (
            <p className="text-xs text-slate-600 font-medium truncate mt-1">
              🏢 {user.company.name}
            </p>
          )}
          {user.branch && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              📍 {user.branch.name} ({user.branch.code})
            </p>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-emerald-600' : 'text-slate-400',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {/* Socket live status indicator */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-xs">
            <span className="text-slate-500 font-medium">الاتصال الحي:</span>
            <span className="inline-flex items-center gap-1.5 font-bold">
              {socketStatus === 'connected' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700">متصل</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="text-slate-500">غير متصل</span>
                </>
              )}
            </span>
          </div>

          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-9"
          >
            <LogOut className="me-2 h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {navItems.find((i) => pathname.startsWith(i.href))?.label || 'ChatPilot'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="h-8 px-2.5 text-xs font-semibold"
            >
              <Globe className="me-1.5 h-3.5 w-3.5" />
              {locale === 'ar' ? 'English' : 'العربية'}
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
