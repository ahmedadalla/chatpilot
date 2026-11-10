'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).slice(2, 9);
      const duration = toast.duration ?? 4000;
      const newToast: ToastMessage = { ...toast, id };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const success = React.useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast],
  );
  const error = React.useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast],
  );
  const warning = React.useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast],
  );
  const info = React.useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 end-4 z-50 flex max-w-md flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
            error: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
            warning: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />,
            info: <Info className="h-5 w-5 text-blue-600 shrink-0" />,
          };

          const borders = {
            success: 'border-emerald-200 bg-white',
            error: 'border-rose-200 bg-white',
            warning: 'border-amber-200 bg-white',
            info: 'border-blue-200 bg-white',
          };

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all text-start animate-fade-in',
                borders[toast.type],
              )}
            >
              {icons[toast.type]}
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{toast.title}</p>
                {toast.message && <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
