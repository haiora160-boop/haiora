'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gift, HeartHandshake, Plus, Star } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Customer = { id: string; fullName: string; phone?: string | null; email?: string | null; points: number; totalSpent: number; orderCount: number; createdAt: string };

export default function CrmPage() {
  const { token } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const [message, setMessage] = useState('');

  async function reload() {
    if (!token) return;
    setCustomers(await apiFetch<Customer[]>('/crm/customers', { token }));
  }

  useEffect(() => { reload().catch(console.error); }, [token]);

  const totals = useMemo(() => ({
    members: customers.length,
    points: customers.reduce((sum, item) => sum + Number(item.points || 0), 0),
    revenue: customers.reduce((sum, item) => sum + Number(item.totalSpent || 0), 0),
  }), [customers]);

  async function createCustomer() {
    if (!token) return;
    await apiFetch('/crm/customers', { method: 'POST', token, body: JSON.stringify(form) });
    setForm({ fullName: '', phone: '', email: '' });
    setMessage('Đã thêm khách hàng vào CRM.');
    await reload();
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <p className="font-black text-pink-600">CRM / Loyalty</p>
          <h1 className="mt-1 text-3xl font-black">Khách hàng, tích điểm, voucher và membership</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Nền tảng để triển khai Zalo/SMS, sinh nhật, voucher quay lại và hạng thành viên.</p>
          {message && <p className="mt-4 rounded-2xl bg-pink-50 p-3 text-sm font-bold text-pink-700 dark:bg-pink-950/30">{message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><HeartHandshake className="text-pink-600" /><p className="mt-3 text-sm font-bold text-slate-500">Khách hàng</p><p className="text-2xl font-black">{totals.members}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Star className="text-orange-600" /><p className="mt-3 text-sm font-bold text-slate-500">Tổng điểm</p><p className="text-2xl font-black">{totals.points}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Gift className="text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-500">Doanh thu CRM</p><p className="text-2xl font-black">{totals.revenue.toLocaleString('vi-VN')}đ</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="text-xl font-black">Thêm khách hàng</h2>
            <div className="mt-4 grid gap-3">
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Tên khách hàng" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Số điện thoại" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
              <button onClick={createCustomer} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 py-3 font-black text-white"><Plus size={18} /> Thêm CRM</button>
            </div>
            <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-800">Roadmap: voucher tự động ngày sinh nhật, tin nhắn Zalo OA, xếp hạng Silver/Gold/VIP và phân tích khách quay lại.</div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="text-xl font-black">Danh sách khách hàng</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {customers.map((item) => <div key={item.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800"><p className="font-black">{item.fullName}</p><p className="text-sm font-bold text-slate-500">{item.phone || 'Chưa có SĐT'}</p><p className="mt-3 text-sm">Điểm: <b>{item.points}</b></p><p className="text-sm">Đã mua: <b>{Number(item.totalSpent || 0).toLocaleString('vi-VN')}đ</b></p><p className="text-xs text-slate-400">{item.orderCount} đơn gần đây</p></div>)}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
