'use client';

import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, QrCode } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Order = {
  id: string;
  code: string;
  total: string | number;
  paymentStatus: string;
  status: string;
  table?: { name: string } | null;
  cashier?: { fullName: string; avatarUrl?: string | null } | null;
  items: Array<{ id: string; name: string; quantity: number; note?: string | null }>;
  payments: Array<{ id: string; method: string; amount: string | number; reference?: string | null }>;
  createdAt: string;
};

type PaymentData = {
  revenue: number;
  paidCount: number;
  unpaidCount: number;
  unpaidOrders: Order[];
  recentPayments: Order[];
  methods: string[];
};

const methodLabels: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ',
  E_WALLET: 'Ví điện tử',
  QR: 'QR',
};

export default function PaymentsPage() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<PaymentData | null>(null);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    if (!token || !user?.branchId) return;
    setData(await apiFetch<PaymentData>(`/payments?branchId=${user.branchId}`, { token }));
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token, user?.branchId]);

  async function pay(order: Order) {
    if (!token) return;
    try {
      await apiFetch(`/pos/orders/${order.id}/payment`, {
        method: 'POST',
        token,
        body: JSON.stringify({ method, amount: Number(order.total), reference }),
      });
      setMessage(`Đã thanh toán hóa đơn ${order.code}`);
      setReference('');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không thanh toán được');
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold text-pink-600">Thu ngân / Payment Hub</p>
          <h1 className="text-3xl font-black">Hệ thống thanh toán</h1>
        </div>
        <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-soft dark:bg-slate-900">
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-xl bg-slate-100 px-4 py-3 font-bold dark:bg-slate-800">
            {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Mã GD / ghi chú" className="rounded-xl bg-slate-100 px-4 py-3 outline-none dark:bg-slate-800" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <Banknote className="text-green-500" />
          <p className="mt-3 text-sm font-bold text-slate-500">Doanh thu đã thanh toán</p>
          <p className="text-3xl font-black">{Number(data?.revenue || 0).toLocaleString('vi-VN')}đ</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <CheckCircle2 className="text-blue-500" />
          <p className="mt-3 text-sm font-bold text-slate-500">Hóa đơn đã thu</p>
          <p className="text-3xl font-black">{data?.paidCount || 0}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <CreditCard className="text-pink-500" />
          <p className="mt-3 text-sm font-bold text-slate-500">Chờ thanh toán</p>
          <p className="text-3xl font-black">{data?.unpaidCount || 0}</p>
        </div>
      </div>

      {message && <p className="mt-4 rounded-2xl bg-blue-50 p-4 font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_420px]">
        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Order chờ thanh toán</h2>
          <div className="space-y-3">
            {data?.unpaidOrders.map((order) => (
              <div key={order.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black">{order.code} · {order.table?.name || 'Mang về'}</p>
                    <p className="text-sm text-slate-500">{order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black text-pink-600">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                    <button onClick={() => pay(order)} className="flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-3 font-black text-white"><QrCode size={18} /> Thu tiền</button>
                  </div>
                </div>
              </div>
            ))}
            {data?.unpaidOrders.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-500 dark:bg-slate-800">Không có order chờ thanh toán.</p>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Lịch sử thu gần đây</h2>
          <div className="space-y-3">
            {data?.recentPayments.map((order) => (
              <div key={order.id} className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black">{order.code}</p>
                    <p className="text-sm text-slate-500">{order.cashier?.fullName || 'Thu ngân'}</p>
                  </div>
                  <p className="font-black text-green-600">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-400">{order.payments.map((payment) => methodLabels[payment.method] || payment.method).join(', ')}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
