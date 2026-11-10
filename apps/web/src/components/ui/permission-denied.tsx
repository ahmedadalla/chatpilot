import * as React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from './button';
import Link from 'next/link';

interface PermissionDeniedProps {
  title?: string;
  message?: string;
  returnUrl?: string;
}

export function PermissionDenied({
  title = 'غير مصرح بالوصول',
  message = 'ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة أو تنفيذ هذا الإجراء.',
  returnUrl = '/',
}: PermissionDeniedProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-4 shadow-xs">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md">{message}</p>
      <Link href={returnUrl} className="mt-6">
        <Button variant="default">
          <ArrowRight className="me-2 h-4 w-4" />
          العودة للرئيسية
        </Button>
      </Link>
    </div>
  );
}
