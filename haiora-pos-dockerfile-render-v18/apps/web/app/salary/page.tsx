'use client';

import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Download, RefreshCw, ShieldCheck, UserCircle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type PayrollRow = {
  user: { id: string; fullName: string; email: string; avatarUrl?: string | null; role: string; employeeCode?: string | null };
  month: string;
  attendanceCount: number;
  completedShiftCount: number;
  totalMinutes: number;
  totalHours: number;
  salaryPerHour: number;
  salaryPerShift: number;
  hourlySalary: number;
  shiftSalary: number;
  commission: number;
  totalSalary: number;
};

type PayrollResponse = {
  month: string;
  canViewAll: boolean;
  rows: PayrollRow[];
  totals: { totalHours: number; hourlySalary: number; commission: number; totalSalary: number };
};

function money(value: number) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function exportPayroll(token: string | null | undefined, month: string, setMessage: (value: string) => void) {
  if (!token) return;
  try {
    const res = await fetch(`${getApiUrl()}/hr/payroll/export?month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Không xuất được file Excel bảng lương');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stype-pos-bang-luong-${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error: any) {
    setMessage(error.message || 'Không xuất được file Excel bảng lương');
  }
}

export default function SalaryPage() {
  const { token, user } = useAuthStore();
  const [month, setMonth] = useState(currentMonth());
  const [payroll, setPayroll] = useState<PayrollResponse | null>(null);
  const [message, setMessage] = useState('');

  const canEditSalary = user?.role === 'OWNER';

  async function reload() {
    if (!token) return;
    const data = await apiFetch<PayrollResponse>(`/hr/payroll?month=${month}`, { token });
    setPayroll(data);
  }

  useEffect(() => {
    reload().catch((error) => setMessage(error.message || 'Không tải được bảng lương'));
  }, [token, month]);

  async function updateSalary(row: PayrollRow) {
    if (!token || !canEditSalary) return;
    const salaryPerHour = window.prompt('Lương theo giờ', String(row.salaryPerHour || 0));
    if (salaryPerHour === null) return;
    const salaryPerShift = window.prompt('Lương theo ca', String(row.salaryPerShift || 0));
    if (salaryPerShift === null) return;
    const commissionRate = window.prompt('Hoa hồng %', '0');
    if (commissionRate === null) return;
    try {
      await apiFetch(`/hr/salary/${row.user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ salaryPerHour: Number(salaryPerHour || 0), salaryPerShift: Number(salaryPerShift || 0), commissionRate: Number(commissionRate || 0) }),
      });
      setMessage('Đã cập nhật mức lương.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không cập nhật được lương');
    }
  }

  const totals = payroll?.totals || { totalHours: 0, hourlySalary: 0, commission: 0, totalSalary: 0 };
  const title = payroll?.canViewAll ? 'Bảng lương nhân viên' : 'Lương của tôi';

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-[var(--kv-primary)]">Lương theo giờ làm</p>
              <h1 className="mt-1 text-2xl font-black">{title}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Chủ quán xem toàn bộ và chỉnh lương. Tài khoản nhân viên chỉ xem được lương của chính mình.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={reload} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-black text-white dark:bg-white dark:text-slate-950"><RefreshCw size={16} /> Tải lại</button>
              <button onClick={() => exportPayroll(token, month, setMessage)} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-black text-white"><Download size={16} /> Xuất Excel</button>
            </div>
          </div>
          {message && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Tổng giờ</p><p className="mt-1 text-2xl font-black">{totals.totalHours.toLocaleString('vi-VN')}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Lương giờ</p><p className="mt-1 text-2xl font-black">{money(totals.hourlySalary)}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-500">Hoa hồng</p><p className="mt-1 text-2xl font-black">{money(totals.commission)}</p></div>
          <div className="rounded-2xl bg-[var(--kv-primary)] p-4 text-white shadow-sm"><p className="text-sm font-bold text-white/80">Tổng lương</p><p className="mt-1 text-2xl font-black">{money(totals.totalSalary)}</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Nhân viên</th>
                  <th className="p-3">Giờ làm</th>
                  <th className="p-3">Lương/giờ</th>
                  <th className="p-3">Lương giờ</th>
                  <th className="p-3">Hoa hồng</th>
                  <th className="p-3">Tổng lương</th>
                  <th className="p-3">Quyền</th>
                </tr>
              </thead>
              <tbody>
                {(payroll?.rows || []).map((row) => (
                  <tr key={row.user.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {row.user.avatarUrl ? <img src={row.user.avatarUrl} className="h-10 w-10 rounded-full object-cover" alt={row.user.fullName} /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-[var(--kv-primary)]"><UserCircle size={22} /></div>}
                        <div>
                          <p className="font-black">{row.user.fullName}</p>
                          <p className="text-xs font-bold text-slate-500">{row.user.email} · {row.user.employeeCode || row.user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-black">{row.totalHours}h</td>
                    <td className="p-3 font-black">{money(row.salaryPerHour)}</td>
                    <td className="p-3 font-black">{money(row.hourlySalary)}</td>
                    <td className="p-3 font-black">{money(row.commission)}</td>
                    <td className="p-3 text-lg font-black text-[var(--kv-primary)]">{money(row.totalSalary)}</td>
                    <td className="p-3">
                      {canEditSalary ? <button onClick={() => updateSalary(row)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"><DollarSign size={14} className="inline" /> Sửa lương</button> : <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 dark:bg-slate-800"><ShieldCheck size={14} /> Chỉ xem</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
