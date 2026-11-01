'use client';

import { AppShell } from '../../components/app-shell';
import { OperationalBoard } from '../../components/operational-board';

export default function KitchenBoardPage() {
  return (
    <AppShell
      title="لوحة المطبخ"
      description="استقبل الطلبات، ابدأ التحضير، وسلّم الطلبات الجاهزة للتوصيل."
    >
      <OperationalBoard kind="kitchen" />
    </AppShell>
  );
}
