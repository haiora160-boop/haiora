'use client';

import { QrCode, Smartphone, Utensils } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuthStore } from '@/stores/auth-store';

export default function SelfOrderPage() {
  const { user } = useAuthStore();
  const demoUrl = `http://localhost:3000/qr/${user?.branchId || 'demo-branch-001'}/table/demo-table-001`;
  return (
    <AppShell>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <p className="font-black text-indigo-600">QR Self-order</p>
          <h1 className="mt-1 text-3xl font-black">Khách tự quét QR gọi món</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Module scaffold cho luồng khách tự gọi món, gọi phục vụ và thanh toán QR. Khi triển khai thật, mỗi bàn sẽ có URL riêng.</p>
          <div className="mt-6 grid place-items-center rounded-[2rem] bg-slate-50 p-8 dark:bg-slate-800"><QrCode size={180} /><p className="mt-4 break-all text-center text-xs font-bold text-slate-500">{demoUrl}</p></div>
        </section>
        <section className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <h2 className="text-xl font-black">Workflow đề xuất</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><Smartphone className="text-indigo-600" /><p className="mt-3 font-black">1. Quét QR</p><p className="mt-2 text-sm text-slate-500">Khách mở menu theo bàn/chi nhánh.</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><Utensils className="text-pink-600" /><p className="mt-3 font-black">2. Gọi món</p><p className="mt-2 text-sm text-slate-500">Order vào POS/KDS sau khi xác nhận.</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><QrCode className="text-emerald-600" /><p className="mt-3 font-black">3. Thanh toán QR</p><p className="mt-2 text-sm text-slate-500">Thu ngân xác nhận hoặc tích hợp cổng thanh toán.</p></div>
          </div>
          <div className="mt-6 rounded-3xl bg-indigo-50 p-5 text-sm font-semibold leading-7 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">Bản tiếp theo nên thêm public route `/qr/[branchId]/table/[tableId]`, giỏ hàng khách, xác nhận OTP hoặc số điện thoại, và QR payment callback.</div>
        </section>
      </div>
    </AppShell>
  );
}
