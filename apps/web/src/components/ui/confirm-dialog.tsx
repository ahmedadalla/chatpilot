import * as React from 'react';
import { Dialog } from './dialog';
import { Button } from './button';
import { Textarea } from './textarea';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'تأكيد الإجراء',
  cancelLabel = 'تراجع',
  loading = false,
  requireReason = false,
  reasonLabel = 'سبب الإجراء (مطلوب للتدقيق)',
  reasonPlaceholder = 'يرجى توضيح سبب الإجراء...',
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError('السبب مطلوب لإتمام هذا الإجراء');
      return;
    }
    await onConfirm(reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-amber-800 border border-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <p className="text-xs leading-relaxed">{message}</p>
        </div>

        {requireReason && (
          <Textarea
            label={reasonLabel}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder={reasonPlaceholder}
            error={error}
            required
            rows={3}
          />
        )}

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            loading={loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
