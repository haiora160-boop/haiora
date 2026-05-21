'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Boxes, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Ingredient = { id: string; name: string; unit: string; minStock?: string | number | null; stock?: number; isLow?: boolean };
type Movement = { id: string; type: string; quantity: string | number; note?: string | null; createdAt: string; ingredient?: Ingredient };
type Summary = { ingredients: Ingredient[]; movements: Movement[] };

export default function InventoryPage() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<Summary>({ ingredients: [], movements: [] });
  const [form, setForm] = useState({ name: '', unit: 'g', minStock: '0' });
  const [movement, setMovement] = useState({ ingredientId: '', type: 'IMPORT', quantity: '1', note: '' });
  const [message, setMessage] = useState('');

  async function reload() {
    if (!token) return;
    const result = await apiFetch<Summary>(`/inventory/summary?branchId=${user?.branchId || ''}`, { token });
    setData(result);
    setMovement((old) => ({ ...old, ingredientId: old.ingredientId || result.ingredients[0]?.id || '' }));
  }

  useEffect(() => { reload().catch(console.error); }, [token, user?.branchId]);

  const lowCount = useMemo(() => data.ingredients.filter((item) => item.isLow).length, [data.ingredients]);

  async function createIngredient() {
    if (!token) return;
    await apiFetch('/inventory/ingredients', { method: 'POST', token, body: JSON.stringify({ name: form.name, unit: form.unit, minStock: Number(form.minStock || 0) }) });
    setForm({ name: '', unit: 'g', minStock: '0' });
    setMessage('Đã thêm nguyên liệu.');
    await reload();
  }

  async function createMovement() {
    if (!token) return;
    await apiFetch('/inventory/movements', { method: 'POST', token, body: JSON.stringify({ branchId: user?.branchId, ingredientId: movement.ingredientId, type: movement.type, quantity: Number(movement.quantity || 0), note: movement.note }) });
    setMovement((old) => ({ ...old, quantity: '1', note: '' }));
    setMessage('Đã ghi nhận nhập/xuất kho.');
    await reload();
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <p className="font-black text-emerald-600">Inventory / Kho nguyên liệu</p>
          <h1 className="mt-1 text-3xl font-black">Định lượng, nhập/xuất và cảnh báo tồn thấp</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Nền tảng để tự trừ kho theo công thức món và kiểm soát thất thoát.</p>
          {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30">{message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Boxes className="text-emerald-600" /><p className="mt-3 text-sm font-bold text-slate-500">Nguyên liệu</p><p className="text-2xl font-black">{data.ingredients.length}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><AlertTriangle className="text-orange-600" /><p className="mt-3 text-sm font-bold text-slate-500">Tồn thấp</p><p className="text-2xl font-black">{lowCount}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><ArrowDownUp className="text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-500">Giao dịch kho</p><p className="text-2xl font-black">{data.movements.length}</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="space-y-4">
            <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
              <h2 className="text-xl font-black">Thêm nguyên liệu</h2>
              <div className="mt-4 grid gap-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cafe hạt, sữa đặc, topping..." className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
                <div className="grid grid-cols-2 gap-3"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Đơn vị" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" /><input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="Tồn tối thiểu" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" /></div>
                <button onClick={createIngredient} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 font-black text-white dark:bg-white dark:text-slate-950"><Plus size={18} /> Thêm nguyên liệu</button>
              </div>
            </div>
            <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
              <h2 className="text-xl font-black">Nhập / xuất kho</h2>
              <div className="mt-4 grid gap-3">
                <select value={movement.ingredientId} onChange={(e) => setMovement({ ...movement, ingredientId: e.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800">{data.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800"><option value="IMPORT">Nhập kho</option><option value="EXPORT">Xuất kho</option><option value="WASTE">Thất thoát/hủy</option><option value="ADJUST_IN">Điều chỉnh tăng</option><option value="ADJUST_OUT">Điều chỉnh giảm</option></select>
                <input type="number" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
                <textarea value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })} placeholder="Ghi chú" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
                <button onClick={createMovement} className="rounded-2xl bg-emerald-600 py-3 font-black text-white">Lưu giao dịch kho</button>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="text-xl font-black">Tồn kho hiện tại</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.ingredients.map((item) => <div key={item.id} className={`rounded-3xl p-4 ${item.isLow ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30' : 'bg-slate-50 dark:bg-slate-800'}`}><p className="font-black">{item.name}</p><p className="mt-1 text-sm font-bold text-slate-500">Tồn tính nhanh: {Number(item.stock || 0).toLocaleString('vi-VN')} {item.unit}</p><p className="text-xs text-slate-400">Tối thiểu: {Number(item.minStock || 0).toLocaleString('vi-VN')} {item.unit}</p></div>)}
            </div>
            <h3 className="mt-6 text-lg font-black">Lịch sử nhập/xuất gần đây</h3>
            <div className="mt-3 space-y-2">{data.movements.slice(0, 12).map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold dark:bg-slate-800">{item.type} · {item.ingredient?.name} · {Number(item.quantity).toLocaleString('vi-VN')} · {new Date(item.createdAt).toLocaleString('vi-VN')}</div>)}</div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
