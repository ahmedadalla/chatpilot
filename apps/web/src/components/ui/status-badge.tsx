import * as React from 'react';
import { Badge } from './badge';
import { OrderStatus, CompanyStatus, WhatsAppConnectionStatus, Role } from '@chatpilot/contracts';

interface StatusBadgeProps {
  status: OrderStatus | CompanyStatus | WhatsAppConnectionStatus | Role | string;
  className?: string;
  locale?: 'ar' | 'en';
}

const statusConfig: Record<
  string,
  {
    labelAr: string;
    labelEn: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  }
> = {
  // OrderStatus
  [OrderStatus.PENDING]: { labelAr: 'قيد المراجعة', labelEn: 'Pending', variant: 'warning' },
  [OrderStatus.ACCEPTED]: { labelAr: 'تم القبول', labelEn: 'Accepted', variant: 'info' },
  [OrderStatus.IN_PREPARATION]: { labelAr: 'جاري التحضير', labelEn: 'In Prep', variant: 'warning' },
  [OrderStatus.READY_FOR_DELIVERY]: {
    labelAr: 'جاهز للتسليم',
    labelEn: 'Ready',
    variant: 'success',
  },
  [OrderStatus.OUT_FOR_DELIVERY]: {
    labelAr: 'في الطريق',
    labelEn: 'Out for Delivery',
    variant: 'info',
  },
  [OrderStatus.DELIVERED]: { labelAr: 'تم التوصيل', labelEn: 'Delivered', variant: 'success' },
  [OrderStatus.CANCELLED]: { labelAr: 'ملغي', labelEn: 'Cancelled', variant: 'destructive' },
  [OrderStatus.FAILED_DELIVERY]: {
    labelAr: 'فشل التوصيل',
    labelEn: 'Failed',
    variant: 'destructive',
  },

  // CompanyStatus
  [CompanyStatus.INITIATED]: { labelAr: 'قيد التهيئة', labelEn: 'Initiated', variant: 'warning' },
  [CompanyStatus.ACTIVE]: { labelAr: 'نشط', labelEn: 'Active', variant: 'success' },
  [CompanyStatus.SUSPENDED]: { labelAr: 'معلق', labelEn: 'Suspended', variant: 'destructive' },

  // WhatsAppConnectionStatus
  [WhatsAppConnectionStatus.CONNECTED]: {
    labelAr: 'متصل',
    labelEn: 'Connected',
    variant: 'success',
  },
  [WhatsAppConnectionStatus.DISCONNECTED]: {
    labelAr: 'غير متصل',
    labelEn: 'Disconnected',
    variant: 'destructive',
  },
  [WhatsAppConnectionStatus.PAIRING_QR_READY]: {
    labelAr: 'بانتظار الاقتران',
    labelEn: 'Pairing Ready',
    variant: 'warning',
  },
  [WhatsAppConnectionStatus.REQUIRES_REAUTH]: {
    labelAr: 'يتطلب إعادة مصادقة',
    labelEn: 'Reauth Required',
    variant: 'destructive',
  },

  // Roles
  [Role.SUPER_ADMIN]: {
    labelAr: 'مدير النظام الأساسي',
    labelEn: 'Super Admin',
    variant: 'destructive',
  },
  [Role.COMPANY_ADMIN]: { labelAr: 'مدير الشركة', labelEn: 'Company Admin', variant: 'default' },
  [Role.BRANCH_MANAGER]: { labelAr: 'مدير الفرع', labelEn: 'Branch Manager', variant: 'info' },
  [Role.KITCHEN]: { labelAr: 'طاقم المطبخ', labelEn: 'Kitchen', variant: 'warning' },
  [Role.DELIVERY]: { labelAr: 'مندوب التوصيل', labelEn: 'Delivery', variant: 'secondary' },
  [Role.STAFF]: { labelAr: 'موظف الاستقبال', labelEn: 'Staff', variant: 'outline' },
};

export function StatusBadge({ status, className, locale = 'ar' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    labelAr: String(status),
    labelEn: String(status),
    variant: 'secondary' as const,
  };

  const label = locale === 'ar' ? config.labelAr : config.labelEn;

  return (
    <Badge variant={config.variant} className={className}>
      {label}
    </Badge>
  );
}
