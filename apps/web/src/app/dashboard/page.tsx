'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { AuthUser, getStoredUser } from '../../lib/auth';

const cards = [
  { href: '/kitchen', title: 'لوحة المطبخ', description: 'الطلبات الجديدة والتحضير والتجهيز', roles: ['KITCHEN', 'STAFF', 'BRANCH_MANAGER'] },
  { href: '/delivery', title: 'لوحة التوصيل', description: 'الطلبات الجاهزة وحالات التسليم', roles: ['DELIVERY', 'BRANCH_MANAGER'] },
  { href: '/company/branches', title: 'إدارة الفروع', description: 'الفروع والإعدادات التشغيلية', roles: ['COMPANY_ADMIN'] },
  { href: '/company/staff', title: 'فريق العمل', description: 'الدعوات والصلاحيات والحسابات', roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/company/menu', title: 'القائمة', description: 'التصنيفات والوجبات والتوافر', roles: ['COMPANY_ADMIN', 'BRANCH_MANAGER'] },
  { href: '/admin/companies', title: 'منصة الشركات', description: 'الدعم المنصي وحالة العملاء', roles: ['SUPER_ADMIN'] },
];

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <AppShell title="لوحة التحكم" description="مساحة عمل موحدة لإدارة التجارة التحادثية والعمليات اليومية.">
      {!user ? null : (
        <div className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-l from-blue-700 to-indigo-950 p-7 text-white shadow-lg sm:p-9">
            <p className="text-sm text-blue-100">مرحباً، {user.name}</p>
            <h2 className="mt-2 text-3xl font-black">ابدأ من مساحة العمل المناسبة</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">
              يتم تحديد الصلاحيات من الخادم. تظهر هنا فقط المساحات المتاحة لدورك الحالي.
            </p>
            <span className="mt-5 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold" dir="ltr">{user.role}</span>
          </section>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.filter((card) => card.roles.includes(user.role)).map((card) => (
              <Link key={card.href} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-lg font-bold text-slate-950">{card.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p></div>
                  <span className="text-xl text-blue-600 transition group-hover:-translate-x-1">←</span>
                </div>
              </Link>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  );
}
