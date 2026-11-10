'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { DataTable } from '../../../../components/ui/data-table';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Select } from '../../../../components/ui/select';
import { FormDialog } from '../../../../components/ui/form-dialog';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useToast } from '../../../../components/ui/toast';
import { formatCurrency } from '../../../../lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Edit2, Archive, Layers, Utensils, SlidersHorizontal } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isArchived: boolean;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isArchived: boolean;
  category?: Category;
}

export default function CompanyMenuPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = React.useState<'items' | 'categories' | 'overrides'>('items');

  // Category State
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [catName, setCatName] = React.useState('');
  const [catDesc, setCatDesc] = React.useState('');
  const [archiveCatTarget, setArchiveCatTarget] = React.useState<Category | null>(null);

  // Item State
  const [itemModalOpen, setItemModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<MenuItem | null>(null);
  const [itemName, setItemName] = React.useState('');
  const [itemDesc, setItemDesc] = React.useState('');
  const [itemPrice, setItemPrice] = React.useState(100);
  const [itemCatId, setItemCatId] = React.useState('');
  const [archiveItemTarget, setArchiveItemTarget] = React.useState<MenuItem | null>(null);

  // Overrides State
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');

  // Queries
  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ['menu', 'categories'],
    queryFn: () => api.get<Category[]>('/api/menu/categories'),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ['menu', 'items'],
    queryFn: () => api.get<MenuItem[]>('/api/menu/items'),
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<any[]>('/api/branches'),
  });

  React.useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: branchOverrides = [], refetch: refetchOverrides } = useQuery<any[]>({
    queryKey: ['menu', 'overrides', selectedBranchId],
    queryFn: () => api.get<any[]>(`/api/menu/branches/${selectedBranchId}/availability`),
    enabled: Boolean(selectedBranchId),
  });

  // Mutations
  const saveCategoryMutation = useMutation({
    mutationFn: (data: any) =>
      editingCategory
        ? api.patch(`/api/menu/categories/${editingCategory.id}`, data)
        : api.post('/api/menu/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
      success('تم حفظ تصنيف القائمة بنجاح');
    },
    onError: (err: any) => toastError('فشل حفظ التصنيف', err?.message),
  });

  const archiveCatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/menu/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      setArchiveCatTarget(null);
      success('تم أرشفة التصنيف');
    },
    onError: (err: any) => toastError('فشل الأرشفة', err?.message),
  });

  const saveItemMutation = useMutation({
    mutationFn: (data: any) =>
      editingItem
        ? api.patch(`/api/menu/items/${editingItem.id}`, data)
        : api.post('/api/menu/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
      setItemModalOpen(false);
      setEditingItem(null);
      setItemName('');
      setItemDesc('');
      success('تم حفظ صنف الطعام بنجاح');
    },
    onError: (err: any) => toastError('فشل حفظ الصنف', err?.message),
  });

  const archiveItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/menu/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
      setArchiveItemTarget(null);
      success('تم أرشفة الصنف');
    },
    onError: (err: any) => toastError('فشل الأرشفة', err?.message),
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ menuItemId, isAvailable, priceOverride }: any) =>
      api.put(`/api/menu/branches/${selectedBranchId}/availability`, {
        menuItemId,
        isAvailable,
        priceOverride: priceOverride || null,
      }),
    onSuccess: () => {
      refetchOverrides();
      success('تم تحديث توفر الصنف في الفرع');
    },
    onError: (err: any) => toastError('فشل التحديث', err?.message),
  });

  // Table Columns
  const itemColumns: ColumnDef<MenuItem>[] = [
    {
      accessorKey: 'name',
      header: 'اسم الصنف',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.original.name}</span>
          <span className="text-xs text-slate-400">
            {row.original.description || 'لا يوجد وصف'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'categoryId',
      header: 'التصنيف',
      cell: ({ row }) => {
        const cat = categories.find((c) => c.id === row.original.categoryId);
        return (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
            {cat?.name || 'عام'}
          </span>
        );
      },
    },
    {
      accessorKey: 'basePrice',
      header: 'السعر الأساسي',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900">
          {formatCurrency(row.original.basePrice, 'EGP')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingItem(item);
                setItemName(item.name);
                setItemDesc(item.description || '');
                setItemPrice(item.basePrice);
                setItemCatId(item.categoryId);
                setItemModalOpen(true);
              }}
              className="h-8 text-xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveItemTarget(item)}
              className="h-8 text-xs text-rose-600 border-rose-200"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  const categoryColumns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: 'اسم التصنيف',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.original.name}</span>
          <span className="text-xs text-slate-400">{row.original.description}</span>
        </div>
      ),
    },
    {
      accessorKey: 'sortOrder',
      header: 'ترتيب العرض',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sortOrder}</span>,
    },
    {
      id: 'actions',
      header: 'الإجراءات',
      cell: ({ row }) => {
        const cat = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCategory(cat);
                setCatName(cat.name);
                setCatDesc(cat.description || '');
                setCategoryModalOpen(true);
              }}
              className="h-8 text-xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveCatTarget(cat)}
              className="h-8 text-xs text-rose-600 border-rose-200"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              إدارة قائمة الطعام والأسعار
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تصنيفات الأصناف، الأسعار الأساسية الموحدة، ومصفوفة توفر الأصناف والأسعار المخصصة لكل
              فرع
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'items' && (
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setItemName('');
                  setItemDesc('');
                  setItemPrice(100);
                  setItemCatId(categories[0]?.id || '');
                  setItemModalOpen(true);
                }}
                className="h-9 text-xs font-semibold"
              >
                <Plus className="me-1 h-4 w-4" />
                إضافة صنف طعام
              </Button>
            )}

            {activeTab === 'categories' && (
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setCatName('');
                  setCatDesc('');
                  setCategoryModalOpen(true);
                }}
                className="h-9 text-xs font-semibold"
              >
                <Plus className="me-1 h-4 w-4" />
                إضافة تصنيف جديد
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('items')}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === 'items'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Utensils className="h-4 w-4" />
            الأصناف الغذائية ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === 'categories'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            تصنيفات القائمة ({categories.length})
          </button>

          <button
            onClick={() => setActiveTab('overrides')}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === 'overrides'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            مصفوفة توفر الفروع وتعديل الأسعار
          </button>
        </div>

        {/* Tab 1: Menu Items */}
        {activeTab === 'items' && (
          <DataTable
            columns={itemColumns}
            data={items.filter((i) => !i.isArchived)}
            loading={itemsLoading}
            searchPlaceholder="بحث في أصناف القائمة..."
            emptyTitle="لا توجد أصناف مسجلة"
          />
        )}

        {/* Tab 2: Categories */}
        {activeTab === 'categories' && (
          <DataTable
            columns={categoryColumns}
            data={categories.filter((c) => !c.isArchived)}
            loading={catsLoading}
            searchPlaceholder="بحث في التصنيفات..."
            emptyTitle="لا توجد تصنيفات مسجلة"
          />
        )}

        {/* Tab 3: Branch Availability Matrix */}
        {activeTab === 'overrides' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-700">
                اختر الفرع لتعديل التوفر والأسعار:
              </span>
              <div className="w-64">
                <Select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  options={branches.map((b: any) => ({
                    label: `${b.name} (${b.code})`,
                    value: b.id,
                  }))}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b">
                  <tr>
                    <th className="px-4 py-3 text-start">الصنف</th>
                    <th className="px-4 py-3 text-start">السعر الموحد</th>
                    <th className="px-4 py-3 text-start">التوفر في الفرع</th>
                    <th className="px-4 py-3 text-start">سعر الفرع المخصص (Override)</th>
                    <th className="px-4 py-3 text-start">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const override = branchOverrides.find((o) => o.menuItemId === item.id);
                    const isAvailable = override ? override.isAvailable : true;
                    const price = override?.priceOverride
                      ? Number(override.priceOverride)
                      : item.basePrice;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatCurrency(item.basePrice, 'EGP')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isAvailable ? 'متوفر للطلب' : 'غير متوفر (نافد)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {override?.priceOverride ? (
                            <span className="text-amber-700">
                              {formatCurrency(price, 'EGP')} (سعر خاص)
                            </span>
                          ) : (
                            <span className="text-slate-400">السعر الافتراضي</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleAvailabilityMutation.mutate({
                                menuItemId: item.id,
                                isAvailable: !isAvailable,
                                priceOverride: override?.priceOverride,
                              })
                            }
                            className={`h-7 text-xs ${
                              isAvailable
                                ? 'text-rose-600 border-rose-200'
                                : 'text-emerald-600 border-emerald-200'
                            }`}
                          >
                            {isAvailable ? 'إيقاف التوفر' : 'تفعيل التوفر'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category Modal */}
        <FormDialog
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          title={editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
          submitLabel="حفظ التصنيف"
          loading={saveCategoryMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            saveCategoryMutation.mutate({
              name: catName.trim(),
              description: catDesc.trim() || undefined,
            });
          }}
        >
          <Input
            label="اسم التصنيف"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="مثال: المشويات، الحلويات، المشروبات"
            required
          />
          <Textarea
            label="وصف التصنيف (اختياري)"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            placeholder="نبذة مختصرة عن هذا القسم..."
          />
        </FormDialog>

        {/* Item Modal */}
        <FormDialog
          open={itemModalOpen}
          onOpenChange={setItemModalOpen}
          title={editingItem ? 'تعديل صنف الطعام' : 'إضافة صنف طعام جديد'}
          submitLabel="حفظ الصنف"
          loading={saveItemMutation.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            saveItemMutation.mutate({
              categoryId: itemCatId,
              name: itemName.trim(),
              description: itemDesc.trim() || undefined,
              basePrice: Number(itemPrice),
            });
          }}
        >
          <Input
            label="اسم الصنف"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="مثال: كباب ضاني مشوي"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="التصنيف"
              value={itemCatId}
              onChange={(e) => setItemCatId(e.target.value)}
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
              required
            />
            <Input
              label="السعر الأساسي الموحد (EGP)"
              type="number"
              value={itemPrice}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              required
            />
          </div>
          <Textarea
            label="مكونات ووصف الصنف"
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            placeholder="المكونات، الوزن، تفاصيل الطبق..."
          />
        </FormDialog>

        {/* Archive Category Confirmation */}
        <ConfirmDialog
          open={Boolean(archiveCatTarget)}
          onOpenChange={(open) => !open && setArchiveCatTarget(null)}
          title={`أرشفة تصنيف ${archiveCatTarget?.name || ''}`}
          message="سيتم أرشفة هذا التصنيف وإخفاؤه من قوائم الطعام للعملاء. يمكنك استعادته لاحقاً."
          confirmLabel="أرشفة"
          onConfirm={async () => {
            if (archiveCatTarget) {
              await archiveCatMutation.mutateAsync(archiveCatTarget.id);
            }
          }}
        />

        {/* Archive Item Confirmation */}
        <ConfirmDialog
          open={Boolean(archiveItemTarget)}
          onOpenChange={(open) => !open && setArchiveItemTarget(null)}
          title={`أرشفة صنف ${archiveItemTarget?.name || ''}`}
          message="سيتم أرشفة هذا الصنف ولن يظهر في القائمة للطلب بعد الآن."
          confirmLabel="أرشفة الصنف"
          onConfirm={async () => {
            if (archiveItemTarget) {
              await archiveItemMutation.mutateAsync(archiveItemTarget.id);
            }
          }}
        />
      </div>
    </AppShell>
  );
}
