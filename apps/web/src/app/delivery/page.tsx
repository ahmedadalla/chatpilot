'use client';

import { AppShell } from '../../components/app-shell';
import { OperationalBoard } from '../../components/operational-board';

export default function DeliveryBoardPage() {
  return (
    <AppShell
      title="لوحة التوصيل"
      description="استلم الطلبات الجاهزة، ابدأ التوصيل، وأكّد التسليم أو سجّل سبب الفشل."
    >
      <OperationalBoard kind="delivery" />
    </AppShell>
  );
}
