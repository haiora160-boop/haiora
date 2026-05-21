'use client';

import { useEffect, useState } from 'react';
import { ChefHat } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';

type Ticket = {
  id: string;
  station: string;
  createdAt: string;
  order: { code: string; table?: { name: string } | null };
  items: Array<{ id: string; name: string; quantity: number; note?: string; status: string }>;
};

const statusLabels: Record<string, string> = {
  WAITING: 'Chờ làm',
  COOKING: 'Đang làm',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export default function KitchenPage() {
  const { token, user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);

  async function load() {
    if (!token || !user?.branchId) return;
    const data = await apiFetch<Ticket[]>(`/kitchen/tickets?branchId=${user.branchId}`, { token });
    setTickets(data);
  }

  useEffect(() => {
    if (!token || !user?.branchId) return;
    load();
    const socket = getSocket();
    socket.emit('joinBranch', { tenantId: user.tenantId, branchId: user.branchId });
    socket.on('kitchen.ticket_created', load);
    socket.on('kitchen.item_status_changed', load);
    return () => {
      socket.off('kitchen.ticket_created');
      socket.off('kitchen.item_status_changed');
    };
  }, [token, user?.branchId, user?.tenantId]);

  async function setStatus(itemId: string, status: string) {
    if (!token) return;
    await apiFetch(`/kitchen/items/${itemId}/status`, { method: 'PATCH', token, body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/40"><ChefHat /></div>
        <div>
          <p className="text-sm font-bold text-orange-600">Realtime Kitchen Display</p>
          <h1 className="text-3xl font-black">Màn hình bếp / bar</h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{ticket.station}</p>
                <h2 className="text-xl font-black">Order {ticket.order.code}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold dark:bg-slate-800">{ticket.order.table?.name || 'Mang về'}</span>
            </div>
            <div className="mt-4 space-y-3">
              {ticket.items.map((item) => (
                <div key={item.id} className="rounded-3xl bg-slate-100 p-4 dark:bg-slate-800">
                  <div className="flex justify-between gap-3">
                    <p className="font-black">{item.quantity} x {item.name}</p>
                    <span className="text-sm font-bold text-blue-600">{statusLabels[item.status]}</span>
                  </div>
                  {item.note && <p className="mt-1 text-sm text-slate-500">Ghi chú: {item.note}</p>}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {['WAITING', 'COOKING', 'DONE'].map((status) => (
                      <button key={status} onClick={() => setStatus(item.id, status)} className="rounded-2xl bg-white py-2 text-sm font-bold dark:bg-slate-700">{statusLabels[status]}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
