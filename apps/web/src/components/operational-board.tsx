'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredUser } from '../lib/auth';
import { apiGet, apiPost, ApiError, API_BASE_URL } from '../lib/api';
import { io } from 'socket.io-client';

type BoardItem = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  items?: Array<{ name: string; quantity: number; notes?: string | null }>;
  address?: string | null;
  phone?: string | null;
  total?: number;
  currency?: string;
  paymentMethod?: string;
  notes?: string | null;
};

type Branch = { id: string; name: string; code: string; isActive: boolean };

const statusLabels: Record<string, string> = {
  PENDING: 'طلبات جديدة',
  ACCEPTED: 'مقبولة',
  IN_PREPARATION: 'قيد التحضير',
  READY_FOR_DELIVERY: 'جاهزة للتوصيل',
  OUT_FOR_DELIVERY: 'جاري التوصيل',
};

function elapsed(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  return minutes === 0 ? 'الآن' : `منذ ${minutes} دقيقة`;
}

export function OperationalBoard({ kind }: { kind: 'kitchen' | 'delivery' }) {
  const user = getStoredUser();
  const [orders, setOrders] = useState<BoardItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(
    !user?.branchId && Boolean(user?.companyId),
  );
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{
    orderId: string;
    action: string;
    reasonCode: string;
    title: string;
  } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const basePath =
        kind === 'kitchen' ? '/api/v1/orders/kitchen/board' : '/api/v1/orders/delivery/board';
      const path =
        selectedBranchId && !user?.branchId
          ? `${basePath}?branchId=${encodeURIComponent(selectedBranchId)}`
          : basePath;
      setOrders(await apiGet<BoardItem[]>(path));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }, [kind, selectedBranchId, user?.branchId]);

  useEffect(() => {
    if (!user?.branchId && user?.companyId) {
      void apiGet<Branch[]>('/api/v1/branches')
        .then((availableBranches) => {
          const activeBranches = availableBranches.filter((branch) => branch.isActive);
          setBranches(activeBranches);
          setSelectedBranchId((current: string) => current || activeBranches[0]?.id || '');
        })
        .catch((loadError) =>
          setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل الفروع.'),
        )
        .finally(() => setBranchesLoading(false));
    }
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    let socket: ReturnType<typeof io> | undefined;
    let cancelled = false;
    void apiPost<{ token: string }>('/api/v1/socket/token')
      .then(({ token }) => {
        if (cancelled) return;
        socket = io(`${API_BASE_URL}/events`, {
          query: { token },
          transports: ['websocket', 'polling'],
        });
        const refresh = () => void load();
        socket.on('order:new', refresh);
        socket.on('order:status_changed', refresh);
        socket.on('delivery:order_ready', refresh);
        socket.on('connect_error', () => {
          // REST polling remains the authoritative fallback.
        });
      })
      .catch(() => {
        // REST polling remains the authoritative fallback.
      });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      socket?.disconnect();
    };
  }, [load]);

  const columns = useMemo(() => {
    const statuses =
      kind === 'kitchen'
        ? ['PENDING', 'ACCEPTED', 'IN_PREPARATION']
        : ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'];
    return statuses.map((status) => ({
      status,
      orders: orders.filter((order) => order.status === status),
    }));
  }, [kind, orders]);

  async function transition(orderId: string, action: string, body?: unknown) {
    setBusyId(orderId);
    setError('');
    try {
      await apiPost(`/api/v1/orders/${orderId}/${action}`, body);
      await load();
    } catch (transitionError) {
      setError(
        transitionError instanceof ApiError ? transitionError.message : 'تعذر تحديث حالة الطلب.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function actionButtons(order: BoardItem) {
    const busy = busyId === order.id;
    if (kind === 'kitchen') {
      if (order.status === 'PENDING') {
        return (
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void transition(order.id, 'accept')}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              قبول
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setReason('');
                setReasonDialog({
                  orderId: order.id,
                  action: 'reject-pending',
                  reasonCode: 'KITCHEN_REJECT',
                  title: 'سبب رفض الطلب',
                });
              }}
              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"
            >
              رفض
            </button>
          </div>
        );
      }
      if (order.status === 'ACCEPTED')
        return (
          <button
            disabled={busy}
            onClick={() => void transition(order.id, 'start-prep')}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            بدء التحضير
          </button>
        );
      if (order.status === 'IN_PREPARATION')
        return (
          <button
            disabled={busy}
            onClick={() => void transition(order.id, 'mark-ready')}
            className="w-full rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            جاهز للتوصيل
          </button>
        );
    } else {
      if (order.status === 'READY_FOR_DELIVERY')
        return (
          <button
            disabled={busy}
            onClick={() => void transition(order.id, 'start-delivery')}
            className="w-full rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            بدء التوصيل
          </button>
        );
      if (order.status === 'OUT_FOR_DELIVERY')
        return (
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void transition(order.id, 'mark-delivered')}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              تم التسليم
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setReason('');
                setReasonDialog({
                  orderId: order.id,
                  action: 'report-failure',
                  reasonCode: 'OTHER',
                  title: 'سبب فشل التوصيل',
                });
              }}
              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"
            >
              فشل
            </button>
          </div>
        );
    }
    return null;
  }

  if (!user?.branchId && branchesLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        جارٍ تحميل فروع الشركة...
      </div>
    );
  }

  if (!user?.branchId && branches.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        لا توجد فروع نشطة متاحة لهذا الحساب.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">الفرع المرتبط بالحساب</p>
          {user?.branchId ? (
            <p className="font-semibold text-slate-800" dir="ltr">
              {user.branchId}
            </p>
          ) : (
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">اختر فرعاً</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          تحديث
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
          جارٍ تحميل الطلبات...
        </div>
      ) : (
        <div className={`grid gap-5 ${kind === 'kitchen' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {columns.map((column) => (
            <section
              key={column.status}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{statusLabels[column.status]}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {column.orders.length}
                </span>
              </div>
              <div className="space-y-3">
                {column.orders.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    لا توجد طلبات في هذه المرحلة.
                  </p>
                )}
                {column.orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-slate-900" dir="ltr">
                        {order.orderNumber}
                      </p>
                      <span className="text-xs text-slate-400">{elapsed(order.createdAt)}</span>
                    </div>
                    {order.items && (
                      <ul className="mt-3 space-y-1 border-y border-slate-100 py-3 text-sm text-slate-700">
                        {order.items.map((item, index) => (
                          <li key={`${item.name}-${index}`} className="flex justify-between gap-2">
                            <span>
                              {item.quantity} × {item.name}
                            </span>
                            {item.notes && (
                              <span className="text-xs text-slate-400">{item.notes}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {kind === 'delivery' && (
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        <p>{order.address || 'العنوان غير مسجل'}</p>
                        <p dir="ltr">{order.phone || 'بدون هاتف'}</p>
                        <p className="font-bold text-slate-900">
                          {order.total?.toFixed(2)} {order.currency}
                        </p>
                      </div>
                    )}
                    <div className="mt-3">{actionButtons(order)}</div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {reasonDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReasonDialog(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reason-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedReason = reason.trim();
              if (!trimmedReason) return;
              void transition(reasonDialog.orderId, reasonDialog.action, {
                reason: trimmedReason,
                reasonCode: reasonDialog.reasonCode,
              });
              setReasonDialog(null);
            }}
          >
            <h2 id="reason-dialog-title" className="text-lg font-bold text-slate-900">
              {reasonDialog.title}
            </h2>
            <label
              htmlFor="transition-reason"
              className="mt-4 block text-sm font-semibold text-slate-700"
            >
              التفاصيل
            </label>
            <textarea
              id="transition-reason"
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReasonDialog(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                disabled={!reason.trim()}
              >
                تأكيد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
