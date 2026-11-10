import * as React from 'react';
import { Dialog } from './dialog';
import { Button } from './button';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
  destructive?: boolean;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'حفظ التغييرات',
  cancelLabel = 'إلغاء',
  loading = false,
  onSubmit,
  children,
  className,
  destructive = false,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={className}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-3">{children}</div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="submit" variant={destructive ? 'destructive' : 'default'} loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
