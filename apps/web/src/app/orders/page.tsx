'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { ApiError, apiGet } from '../../lib/api';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  address: string | null;
  phone: string | null;
  notes: string | null;
  paymentMethod: string;
  source: string;
  createdAt: string;
  items?: Array<{ id: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number; lineTotal: number; notes: string | null }>;
  statusHistory?: Array<{ id: string; fromStatus: string; toStatus: string; actorRole: string; reason: string | null; occurredAt: string }>;
};

const filters = [
  ['ALL', 'كل الطلبات'],
  ['PENDING', 'جديدة'],
  ['ACCEPTED', 'مقبولة'],
  ['IN_PREPARATION', 'قيد التحضير'],
  ['READY_FOR_DELIVERY', 'جاهزة للتوصيل'],
  ['OUT_FOR_DELIVERY', 'جاري التوصيل'],
  ['DELIVERED', 'مسلّمة'],
  ['CANCELLED', 'ملغاة'],
  ['FAILED_DELIVERY', 'فشل التوصيل'],
] as const;

const labels = Object.fromEntries(filters.map(([value, label]) => [value, label]));

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = status === 'ALL' ? '' : `?status=${encodeURIComponent(status)}`;
      setOrders(await apiGet<Order[]>(`/api/v1/orders${query}`));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell title="الطلبات" description="آخر 50 طلباً ضمن النطاق المسموح لدورك، مع تفاصيل العناصر وسجل الحالات.">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${status === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{label}</button>)}</div>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل الطلبات...</p> : orders.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد طلبات في هذا الفلتر.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">الطلب</th><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">المصدر</th><th className="px-5 py-3">الإجمالي</th><th className="px-5 py-3">التاريخ</th><th className="px-5 py-3">التفاصيل</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order) => <tr key={order.id}><td className="px-5 py-4 font-bold" dir="ltr">{order.orderNumber}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{labels[order.status] || order.status}</span></td><td className="px-5 py-4 text-slate-500">{order.source}</td><td className="px-5 py-4 font-bold" dir="ltr">{order.total.toFixed(2)} {order.currency}</td><td className="px-5 py-4 text-slate-500" dir="ltr">{new Date(order.createdAt).toLocaleString('ar-EG')}</td><td className="px-5 py-4"><button type="button" onClick={() => setSelected(order)} className="text-xs font-bold text-blue-600 hover:underline">عرض التفاصيل</button></td></tr>)}</tbody></table></div>}
        </section>
        {selected && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`تفاصيل ${selected.orderNumber}`}><article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-500">رقم الطلب</p><h2 className="text-2xl font-black" dir="ltr">{selected.orderNumber}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-2 text-sm">إغلاق</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm"><p><span className="text-slate-500">الحالة:</span> {labels[selected.status] || selected.status}</p><p><span className="text-slate-500">الدفع:</span> {selected.paymentMethod}</p><p><span className="text-slate-500">الهاتف:</span> <span dir="ltr">{selected.phone || '—'}</span></p><p><span className="text-slate-500">العنوان:</span> {selected.address || '—'}</p></div><h3 className="mt-6 font-black">العناصر</h3><div className="mt-3 divide-y rounded-xl border">{selected.items?.map((item) => <div key={item.id} className="flex justify-between gap-4 p-3 text-sm"><span>{item.quantity} × {item.nameSnapshot}</span><span dir="ltr">{item.lineTotal.toFixed(2)} {selected.currency}</span></div>)}</div><div className="mt-4 space-y-1 text-sm text-slate-600"><p>قيمة العناصر: <span dir="ltr">{selected.subtotal.toFixed(2)}</span></p><p>التوصيل: <span dir="ltr">{selected.deliveryFee.toFixed(2)}</span></p><p>الخصم: <span dir="ltr">{selected.discount.toFixed(2)}</span></p><p className="font-black text-slate-950">الإجمالي: <span dir="ltr">{selected.total.toFixed(2)} {selected.currency}</span></p></div><h3 className="mt-6 font-black">سجل الحالات</h3><div className="mt-3 space-y-3">{selected.statusHistory?.length ? selected.statusHistory.map((entry) => <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{labels[entry.fromStatus] || entry.fromStatus} ← {labels[entry.toStatus] || entry.toStatus}</p><p className="mt-1 text-xs text-slate-500">{entry.actorRole} · {new Date(entry.occurredAt).toLocaleString('ar-EG')}</p>{entry.reason && <p className="mt-1 text-slate-600">{entry.reason}</p>}</div>) : <p className="text-sm text-slate-500">لا يوجد سجل حالات.</p>}</div></article></div>}
      </div>
    </AppShell>
  );
}
