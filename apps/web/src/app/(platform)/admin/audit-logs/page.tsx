'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { Badge } from '../../../../components/ui/badge';
import { Dialog } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { formatDateTime } from '../../../../lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  actorUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  company?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  details: any;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [selectedLog, setSelectedLog] = React.useState<AuditLogRow | null>(null);

  const { data, isLoading } = useQuery<{ items: AuditLogRow[]; total: number }>({
    queryKey: ['platform', 'audit-logs'],
    queryFn: () => api.get<{ items: AuditLogRow[]; total: number }>('/api/platform/audit-logs'),
  });

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'التاريخ والتوقيت',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'الحدث الأمني (Action)',
      cell: ({ row }) => {
        const action = row.original.action;
        let variant: 'default' | 'destructive' | 'warning' | 'info' | 'secondary' = 'secondary';
        if (action.includes('SUSPENDED') || action.includes('DEACTIVATED')) variant = 'destructive';
        if (action.includes('CREATED') || action.includes('ACTIVATED')) variant = 'default';
        if (action.includes('CROSS_TENANT')) variant = 'warning';

        return (
          <Badge variant={variant} className="font-mono text-[10px]">
            {action}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'actorUser',
      header: 'المستخدم الفاعل',
      cell: ({ row }) => {
        const actor = row.original.actorUser;
        if (!actor) return <span className="text-xs text-slate-400">النظام التلقائي (System)</span>;
        return (
          <div>
            <span className="font-semibold text-slate-800 text-xs block">{actor.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">{actor.email}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'company',
      header: 'المستأجر (الشركة)',
      cell: ({ row }) => {
        const co = row.original.company;
        if (!co) return <span className="text-xs text-slate-400">نظامي عام (Platform)</span>;
        return <span className="font-bold text-slate-700 text-xs">{co.name}</span>;
      },
    },
    {
      id: 'details',
      header: 'التفاصيل',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedLog(row.original)}
          className="h-7 text-xs px-2"
        >
          <Eye className="me-1 h-3.5 w-3.5 text-slate-500" />
          عرض
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            سجل تدقيق النظام الأمني (Audit Logs)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            سجل غير قابل للتعديل يوثق جميع الأحداث الإدارية، تدقيق المستأجرين، التعليق، والتغييرات
            الحساسة
          </p>
        </div>

        <DataTable
          columns={columns}
          data={data?.items || []}
          loading={isLoading}
          searchPlaceholder="بحث في أحداث التدقيق..."
          emptyTitle="لا توجد سجلات تدقيق مسجلة"
        />

        {/* Details Dialog */}
        <Dialog
          open={Boolean(selectedLog)}
          onOpenChange={(open) => !open && setSelectedLog(null)}
          title={`تفاصيل حدث: ${selectedLog?.action || ''}`}
        >
          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border space-y-1">
                <div>
                  <span className="font-semibold text-slate-600">التوقيت:</span>{' '}
                  {formatDateTime(selectedLog.createdAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-600">الفاعل:</span>{' '}
                  {selectedLog.actorUser?.name || 'System'} ({selectedLog.actorUser?.email || 'N/A'}
                  )
                </div>
                <div>
                  <span className="font-semibold text-slate-600">النوع المستهدف:</span>{' '}
                  {selectedLog.entityType} ({selectedLog.entityId || 'N/A'})
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-1">حمولة التفاصيل (Payload JSON):</p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </AppShell>
  );
}
