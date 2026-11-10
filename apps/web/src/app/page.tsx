'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';
import { useLocale } from '../providers/locale-provider';
import { Button } from '../components/ui/button';
import { Role } from '@chatpilot/contracts';
import { ShieldCheck, MessageSquare, Utensils, Globe, ArrowLeft, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { locale, toggleLocale } = useLocale();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      switch (user.role) {
        case Role.SUPER_ADMIN:
          router.push('/admin/dashboard');
          break;
        case Role.COMPANY_ADMIN:
          router.push('/company/dashboard');
          break;
        case Role.BRANCH_MANAGER:
          router.push('/branch/dashboard');
          break;
        case Role.KITCHEN:
          router.push('/kitchen');
          break;
        case Role.DELIVERY:
          router.push('/delivery');
          break;
        case Role.STAFF:
          router.push('/staff');
          break;
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white flex flex-col justify-between">
      {/* Header */}
      <header className="flex h-20 items-center justify-between px-6 sm:px-12 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white font-black text-xl shadow-lg">
            CP
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight">ChatPilot</span>
            <span className="ms-2 text-xs text-emerald-400 font-semibold">منصة شات بايلوت</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLocale}
            className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white text-xs"
          >
            <Globe className="me-1.5 h-3.5 w-3.5" />
            {locale === 'ar' ? 'English' : 'العربية'}
          </Button>

          <Link href="/login">
            <Button className="bg-emerald-500 hover:bg-emerald-600 font-bold text-white shadow-md">
              تسجيل الدخول
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-6 backdrop-blur-xs">
          <ShieldCheck className="h-4 w-4" />
          عزل أمني تام للمستأجرين • Row-Level Security
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight sm:leading-tight">
          منصة التجارة التحادثية وإدارة المطاعم متعددة الفروع
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          نظام متكامل وشامل لإدارة الطلبات، شاشات المطبخ، والتوصيل، مع دعم المحادثات الذكية عبر
          واتساب والذكاء الاصطناعي بدقة وموثوقية فائقة.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 px-8 text-base shadow-lg"
            >
              الدخول إلى النظام
              {locale === 'ar' ? (
                <ArrowLeft className="ms-2 h-5 w-5" />
              ) : (
                <ArrowRight className="ms-2 h-5 w-5" />
              )}
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-start">
          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">قنوات واتساب متعددة</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              دعم Meta Cloud API، تطبيق الأعمال المشترك، والربط المباشر برمز الاستجابة السريعة (QR).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Utensils className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">عمليات تشغيل فورية</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              شاشات ذكية للمطبخ والمندوبين تعمل لحظياً عبر Socket.IO لتحديث حالات الطلبات بدقة.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">أمان وصلاحيات دقيقة</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              6 أدوار مستخدمين، عزل مالي وتشغيلي صارم، وحماية متقدمة متعددة المستأجرين.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        ChatPilot © {new Date().getFullYear()} — Enterprise Multi-Tenant Restaurant SaaS
      </footer>
    </main>
  );
}
