import type { Metadata } from 'next';
import React from 'react';
import '../styles/globals.css';
import { LocaleProvider } from '../providers/locale-provider';
import { QueryProvider } from '../providers/query-provider';
import { ToastProvider } from '../components/ui/toast';
import { AuthProvider } from '../providers/auth-provider';
import { SocketProvider } from '../providers/socket-provider';

export const metadata: Metadata = {
  title: 'ChatPilot | منصة شات بايلوت',
  description: 'Enterprise Multi-Tenant Conversational Commerce Engine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <LocaleProvider>
          <QueryProvider>
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>{children}</SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </QueryProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
