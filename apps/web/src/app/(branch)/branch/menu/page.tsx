'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../providers/auth-provider';
import { AppShell } from '../../../../components/layout/app-shell';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { TableSkeleton } from '../../../../components/ui/loading-skeleton';
import { useToast } from '../../../../components/ui/toast';
import { formatCurrency } from '../../../../lib/utils';
import { Edit2 } from 'lucide-react';

export default function BranchMenuPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const branchId = user?.branchId;

  const [priceTargetItem, setPriceTargetItem] = React.useState<any | null>(null);
  const [customPrice, setCustomPrice] = React.useState<number>(0);

  const { data: menu = [], isLoading } = useQuery<any[]>({
    queryKey: ['menu', 'branch', branchId, 'resolved'],
    queryFn: () => api.get<any[]>(`/api/menu/branches/${branchId}/resolved`),
    enabled: Boolean(branchId),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ menuItemId, isAvailable, priceOverride }: any) =>
      api.put(`/api/menu/branches/${branchId}/availability`, {
        menuItemId,
        isAvailable,
        priceOverride: priceOverride || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'branch', branchId, 'resolved'] });
      setPriceTargetItem(null);
      success('تم تحديث إعدادات الصنف بالفرع');
    },
    onError: (err: any) => toastError('فشل التحديث', err?.message),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            توفر أصناف الطعام بالفرع
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إيقاف وتفعيل الأصناف المتوفرة للطلب بالفرع (In-Stock / Out-of-Stock) وتحديد أسعار خاصة
            بالفرع
          </p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b">
                <tr>
                  <th className="px-4 py-3 text-start">اسم الصنف</th>
                  <th className="px-4 py-3 text-start">السعر المعتمد للفرع</th>
                  <th className="px-4 py-3 text-start">حالة التوفر الحالية</th>
                  <th className="px-4 py-3 text-start">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menu.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {formatCurrency(item.resolvedPrice, 'EGP')}
                      {item.hasPriceOverride && (
                        <span className="ms-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          سعر مخصص
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.isAvailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.isAvailable ? 'متوفر للطلب' : 'نافد (Out of Stock)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({
                            menuItemId: item.id,
                            isAvailable: !item.isAvailable,
                            priceOverride: item.hasPriceOverride ? item.resolvedPrice : undefined,
                          })
                        }
                        className={`h-7 text-xs ${
                          item.isAvailable
                            ? 'text-rose-600 border-rose-200'
                            : 'text-emerald-600 border-emerald-200'
                        }`}
                      >
                        {item.isAvailable ? 'تعيين كنافد' : 'تعيين كمتوفر'}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPriceTargetItem(item);
                          setCustomPrice(item.resolvedPrice);
                        }}
                        className="h-7 text-xs"
                      >
                        <Edit2 className="h-3 w-3 me-1" />
                        تعديل السعر
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom Price Modal */}
        <FormDialog
          open={Boolean(priceTargetItem)}
          onOpenChange={(open) => !open && setPriceTargetItem(null)}
          title={`تعديل سعر الصنف في الفرع: ${priceTargetItem?.name || ''}`}
          submitLabel="حفظ السعر"
          loading={toggleMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            if (priceTargetItem) {
              toggleMutation.mutate({
                menuItemId: priceTargetItem.id,
                isAvailable: priceTargetItem.isAvailable,
                priceOverride: Number(customPrice),
              });
            }
          }}
        >
          <Input
            label="السعر المخصص لفرعك (EGP)"
            type="number"
            value={customPrice}
            onChange={(e) => setCustomPrice(Number(e.target.value))}
            required
          />
        </FormDialog>
      </div>
    </AppShell>
  );
}
