import * as React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'فشل تحميل البيانات',
  message = 'حدث خطأ أثناء الاتصال بالخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-200 bg-rose-50/50 ${className || ''}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-rose-900">{title}</h3>
      <p className="mt-1 text-xs text-rose-700 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-4 border-rose-300 text-rose-700 hover:bg-rose-100"
        >
          <RotateCcw className="me-1.5 h-3.5 w-3.5" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
