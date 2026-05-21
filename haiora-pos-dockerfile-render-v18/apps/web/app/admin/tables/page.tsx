'use client';

import { useEffect, useState } from 'react';
import { Armchair, Layers3, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Table = { id: string; name: string; capacity?: number | null; status: string; areaId: string };
type Area = { id: string; name: string; sortOrder: number; tables: Table[] };
type Branch = { id: string; name: string };

const tableStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];

export default function AdminTablesPage() {
  const { token, user } = useAuthStore();
  const [areas, setAreas] = useState<Area[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [message, setMessage] = useState('');
  const [areaForm, setAreaForm] = useState({ name: '', sortOrder: '1', branchId: '' });
  const [tableForm, setTableForm] = useState({ name: '', capacity: '4', areaId: '', branchId: '' });
  const [editing, setEditing] = useState<Table | null>(null);

  async function reload() {
    if (!token) return;
    const [areaList, branchList] = await Promise.all([
      apiFetch<Area[]>('/areas', { token }),
      apiFetch<Branch[]>('/branches', { token }),
    ]);
    setAreas(areaList);
    setBranches(branchList);
    const branchId = user?.branchId || branchList[0]?.id || '';
    setAreaForm((old) => ({ ...old, branchId: old.branchId || branchId }));
    setTableForm((old) => ({ ...old, branchId: old.branchId || branchId, areaId: old.areaId || areaList[0]?.id || '' }));
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  async function createArea() {
    if (!token) return;
    try {
      await apiFetch('/areas', {
        method: 'POST',
        token,
        body: JSON.stringify({ branchId: areaForm.branchId, name: areaForm.name, sortOrder: Number(areaForm.sortOrder || 0) }),
      });
      setAreaForm((old) => ({ ...old, name: '' }));
      setMessage('Đã thêm khu vực mới.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không thêm được khu vực');
    }
  }

  async function createTable() {
    if (!token) return;
    try {
      await apiFetch('/tables', {
        method: 'POST',
        token,
        body: JSON.stringify({ branchId: tableForm.branchId, areaId: tableForm.areaId, name: tableForm.name, capacity: Number(tableForm.capacity || 4) }),
      });
      setTableForm((old) => ({ ...old, name: '' }));
      setMessage('Đã thêm bàn mới. POS sẽ cập nhật realtime.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không thêm được bàn');
    }
  }

  async function updateTable() {
    if (!token || !editing) return;
    try {
      await apiFetch(`/tables/${editing.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name: editing.name, capacity: Number(editing.capacity || 4), status: editing.status, areaId: editing.areaId }),
      });
      setEditing(null);
      setMessage('Đã cập nhật bàn.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không cập nhật được bàn');
    }
  }

  async function deleteTable(table: Table) {
    if (!token) return;
    if (!confirm(`Xóa ${table.name}?`)) return;
    await apiFetch(`/tables/${table.id}`, { method: 'DELETE', token });
    setMessage('Đã xóa bàn.');
    await reload();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm font-bold text-pink-600">Admin / Sơ đồ bàn</p>
        <h1 className="text-3xl font-black">Thêm bàn, khu vực và quản lý trạng thái</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <section className="space-y-4">
          <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-950/50"><Layers3 /></div>
              <div>
                <h2 className="font-black">Thêm khu vực</h2>
                <p className="text-sm text-slate-500">Ví dụ: Tầng 1, Sân vườn, VIP.</p>
              </div>
            </div>
            <div className="space-y-3">
              <select value={areaForm.branchId} onChange={(e) => setAreaForm({ ...areaForm, branchId: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} placeholder="Tên khu vực" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input value={areaForm.sortOrder} onChange={(e) => setAreaForm({ ...areaForm, sortOrder: e.target.value })} type="number" placeholder="Thứ tự" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={createArea} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-black text-white dark:bg-white dark:text-slate-950"><Plus size={18} /> Thêm khu vực</button>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50"><Armchair /></div>
              <div>
                <h2 className="font-black">Thêm bàn</h2>
                <p className="text-sm text-slate-500">Bàn mới sẽ hiện ngay ở POS.</p>
              </div>
            </div>
            <div className="space-y-3">
              <select value={tableForm.areaId} onChange={(e) => setTableForm({ ...tableForm, areaId: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
              <input value={tableForm.name} onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })} placeholder="Tên bàn / phòng" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })} type="number" placeholder="Sức chứa" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={createTable} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 py-4 font-black text-white"><Plus size={18} /> Thêm bàn</button>
              {message && <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Sơ đồ bàn hiện tại</h2>
          <div className="space-y-5">
            {areas.map((area) => (
              <div key={area.id}>
                <p className="mb-3 font-black text-slate-500">{area.name}</p>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {area.tables.map((table) => (
                    <div key={table.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/70">
                      {editing?.id === table.id ? (
                        <div className="space-y-2">
                          <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-2xl bg-white p-3 dark:bg-slate-700" />
                          <input value={editing.capacity || 4} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} type="number" className="w-full rounded-2xl bg-white p-3 dark:bg-slate-700" />
                          <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="w-full rounded-2xl bg-white p-3 dark:bg-slate-700">
                            {tableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <button onClick={updateTable} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 font-black text-white"><Save size={16} /> Lưu</button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-lg font-black">{table.name}</p>
                              <p className="text-sm text-slate-500">Sức chứa: {table.capacity || 4} · {table.status}</p>
                            </div>
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-pink-600 dark:bg-slate-700"><Armchair /></div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => setEditing(table)} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-white py-2 text-sm font-black dark:bg-slate-700"><Pencil size={15} /> Sửa</button>
                            <button onClick={() => deleteTable(table)} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-red-50 py-2 text-sm font-black text-red-600 dark:bg-red-950/30"><Trash2 size={15} /> Xóa</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
