'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell } from '@/components/app-shell';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type RevenueReport = {
  summary: { revenue: number; orders: number; paidOrders: number; cancelledOrders: number; payments: number; averageOrder: number };
  daily: Array<{ date: string; revenue: number; orders: number; payments: number }>;
  methods: Array<{ method: string; amount: number }>;
  topProducts: Array<{ name: string; _sum: { quantity: number | null; total: string | number | null } }>;
  recentPayments: Array<{ id: string; method: string; amount: string | number; reference?: string | null; createdAt: string; order: { code: string; total: string | number; createdAt: string } }>;
};

function money(value: number | string) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

const methodLabel: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ',
  E_WALLET: 'Ví điện tử',
  QR: 'QR',
};

export default function ReportsPage() {
  const { token } = useAuthStore();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [message, setMessage] = useState('');

  const query = useMemo(() => `from=${from}&to=${to}`, [from, to]);

  async function reload() {
    if (!token) return;
    try {
      const data = await apiFetch<RevenueReport>(`/reports/revenue?${query}`, { token });
      setReport(data);
      setMessage('');
    } catch (error: any) {
      setMessage(error.message || 'Không tải được báo cáo doanh thu');
    }
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token, query]);

  async function exportExcel() {
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/reports/revenue/export?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Không xuất được file Excel có kẻ khung');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stype-pos-bao-cao-doanh-thu-${from}-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setMessage(error.message || 'Không xuất được Excel');
    }
  }

  const summary = report?.summary || { revenue: 0, orders: 0, paidOrders: 0, cancelledOrders: 0, payments: 0, averageOrder: 0 };

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-[var(--kv-primary)]">Báo cáo doanh thu</p>
              <h1 className="mt-1 text-2xl font-black">Doanh thu · đơn hàng · phương thức thanh toán</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Kiểm tra doanh thu theo ngày/tháng và xuất Excel để đối soát.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none dark:border-slate-700 dark:bg-slate-800" />
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={reload} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-black text-white dark:bg-white dark:text-slate-950"><RefreshCw size={16} /> Tải lại</button>
              <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-black text-white"><Download size={16} /> Xuất Excel</button>
            </div>
          </div>
          {message && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30">{message}</p>}
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Doanh thu</p><p className="mt-1 text-2xl font-black text-[var(--kv-primary)]">{money(summary.revenue)}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Đơn đã thanh toán</p><p className="mt-1 text-2xl font-black">{summary.paidOrders}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Giá trị TB/đơn</p><p className="mt-1 text-2xl font-black">{money(summary.averageOrder)}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Đơn hủy</p><p className="mt-1 text-2xl font-black text-red-600">{summary.cancelledOrders}</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><TrendingUp size={20} /> Doanh thu theo ngày</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report?.daily || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="revenue" name="Doanh thu" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><BarChart3 size={20} /> Thanh toán</h2>
            <div className="space-y-3">
              {(report?.methods || []).map((item) => (
                <div key={item.method} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{methodLabel[item.method] || item.method}</p>
                    <p className="font-black text-[var(--kv-primary)]">{money(item.amount)}</p>
                  </div>
                </div>
              ))}
              {(report?.methods || []).length === 0 && <p className="text-sm font-bold text-slate-500">Chưa có thanh toán trong khoảng thời gian này.</p>}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-black">Top món bán chạy</h2>
            <div className="space-y-2">
              {(report?.topProducts || []).map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="font-black">{index + 1}. {item.name}</p>
                  <p className="text-sm font-black text-[var(--kv-primary)]">SL {item._sum.quantity || 0} · {money(Number(item._sum.total || 0))}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-black">Thanh toán gần đây</h2>
            <div className="max-h-96 space-y-2 overflow-auto">
              {(report?.recentPayments || []).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div>
                    <p className="font-black">{payment.order.code} · {methodLabel[payment.method] || payment.method}</p>
                    <p className="text-xs font-bold text-slate-500">{new Date(payment.createdAt).toLocaleString('vi-VN')} · {payment.reference || 'Không mã GD'}</p>
                  </div>
                  <p className="font-black text-[var(--kv-primary)]">{money(payment.amount)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
