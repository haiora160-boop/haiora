'use client';

import { useEffect, useState } from 'react';
import { FileClock, Search } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type AuditLog = { id: string; action: string; module: string; metadata?: any; createdAt: string; user?: { fullName: string; role: string; avatarUrl?: string | null } | null };

const importantActions: Record<string, string> = {
  CANCEL_BILL: 'Ai hủy bill?',
  EDIT_ITEM_PRICE: 'Ai sửa giá?',
  DISCOUNT_ORDER: 'Ai giảm món/bill?',
  PAY_ORDER: 'Ai thanh toán?',
  CHANGE_TABLE: 'Ai chuyển bàn?',
  SPLIT_BILL: 'Ai tách bill?',
  MERGE_BILL: 'Ai gộp bill?',
  PRINT_INVOICE: 'Ai in hóa đơn?',
};

export default function AuditLogsPage() {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState('');

  async function reload() {
    if (!token) return;
    setLogs(await apiFetch<AuditLog[]>('/audit-logs', { token }));
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  const filtered = logs.filter((log) => `${log.action} ${log.module} ${log.user?.fullName || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <p className="font-black text-pink-600">Audit log</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><FileClock /> Nhật ký thao tác</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Trả lời nhanh các câu hỏi: ai hủy bill, ai sửa giá, ai giảm món, ai chuyển bàn, ai thanh toán.</p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
            <Search size={18} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo thao tác, nhân viên, module..." className="w-full bg-transparent font-bold outline-none" />
          </div>
        </div>

        <div className="grid gap-3">
          {filtered.map((log) => (
            <div key={log.id} className="rounded-[1.5rem] bg-white p-5 shadow-soft dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-pink-600">{importantActions[log.action] || log.action}</p>
                  <h2 className="text-xl font-black">{log.action} · {log.module}</h2>
                  <p className="text-sm font-bold text-slate-500">{log.user?.fullName || 'Hệ thống'} · {log.user?.role || 'SYSTEM'} · {new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black dark:bg-slate-800">{log.module}</span>
              </div>
              <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(log.metadata || {}, null, 2)}</pre>
            </div>
          ))}
          {filtered.length === 0 && <p className="rounded-[1.5rem] bg-white p-5 font-bold text-slate-500 shadow-soft dark:bg-slate-900">Chưa có nhật ký phù hợp.</p>}
        </div>
      </div>
    </AppShell>
  );
}
