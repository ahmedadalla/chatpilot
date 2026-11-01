import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">
          ChatPilot | شات بايلوت
        </h1>
        <p className="text-base text-slate-600 mb-6">
          منصة التجارة التحادثية متعددة الفروع والمطاعم — مصممة للنمو والتوسع السريع.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            Multi-Tenant Isolation
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200">
            Meta Cloud API & WhatsApp QR
          </span>
          <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 border border-purple-200">
            Arabic RTL / English
          </span>
        </div>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          تسجيل الدخول إلى لوحة التحكم
        </Link>
      </div>
    </main>
  );
}
