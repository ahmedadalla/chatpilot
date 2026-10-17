import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'ChatPilot | منصة شات بايلوت',
  description: 'Enterprise Multi-Tenant Conversational Commerce Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
