'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, Clock3, LockKeyhole, PlayCircle, ReceiptText, WalletCards } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Shift = {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: string | number;
  closingCash?: string | number | null;
  cashSales: string | number;
  bankSales: string | number;
  qrSales: string | number;
  cardSales: string | number;
  eWalletSales: string | number;
  expectedCash: string | number;
  difference: string | number;
  note?: string | null;
  status: string;
};

function money(value: string | number | null | undefined) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

export default function ShiftsPage() {
  const { token, user } = useAuthStore();
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('0');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    if (!token) return;
    const [currentShift, shifts] = await Promise.all([
      apiFetch<Shift | null>('/shifts/current', { token }),
      apiFetch<Shift[]>('/shifts', { token }),
    ]);
    setCurrent(currentShift);
    setHistory(shifts);
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  const paidSummary = useMemo(() => {
    const lastClosed = history.find((item) => item.status === 'CLOSED');
    return lastClosed;
  }, [history]);

  async function openShift() {
    if (!token) return;
    try {
      const shift = await apiFetch<Shift>('/shifts/open', {
        method: 'POST',
        token,
        body: JSON.stringify({ openingCash: Number(openingCash || 0), note }),
      });
      setCurrent(shift);
      setMessage('Đã mở ca. Bắt đầu ghi nhận doanh thu trong ca.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không mở được ca');
    }
  }

  async function closeShift() {
    if (!token || !current) return;
    try {
      const shift = await apiFetch<Shift>(`/shifts/${current.id}/close`, {
        method: 'POST',
        token,
        body: JSON.stringify({ closingCash: Number(closingCash || 0), note }),
      });
      setCurrent(null);
      setMessage(`Đã kết ca. Chênh lệch: ${money(shift.difference)}`);
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không kết ca được');
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold text-pink-600">Thu ngân / Kết ca</p>
          <h1 className="text-3xl font-black">Mở ca, chốt tiền trong ca và trong ngày</h1>
          <p className="mt-2 text-slate-500">Tài khoản: {user?.fullName} · Hệ thống tự cộng doanh thu theo phương thức thanh toán.</p>
        </div>
        <div className="rounded-[1.5rem] bg-white px-5 py-3 font-black shadow-soft dark:bg-slate-900">
          {current ? 'Ca đang mở' : 'Chưa mở ca'}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-950/50"><WalletCards /></div>
            <div>
              <h2 className="font-black">{current ? 'Kết ca hiện tại' : 'Mở ca mới'}</h2>
              <p className="text-sm text-slate-500">Nhập tiền đầu ca hoặc tiền thực tế khi đóng ca.</p>
            </div>
          </div>

          {!current ? (
            <div className="space-y-3">
              <input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} type="number" placeholder="Tiền đầu ca" className="w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú mở ca" className="h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={openShift} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 font-black text-white"><PlayCircle size={18} /> Mở ca</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-sm text-slate-500">Mở lúc</p>
                <p className="font-black">{new Date(current.openedAt).toLocaleString('vi-VN')}</p>
                <p className="mt-2 text-sm text-slate-500">Tiền đầu ca</p>
                <p className="text-xl font-black text-pink-600">{money(current.openingCash)}</p>
              </div>
              <input value={closingCash} onChange={(e) => setClosingCash(e.target.value)} type="number" placeholder="Tiền mặt thực tế cuối ca" className="w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú kết ca" className="h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <button onClick={closeShift} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-black text-white dark:bg-white dark:text-slate-950"><LockKeyhole size={18} /> Kết ca / Chốt tiền</button>
            </div>
          )}
          {message && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900"><ReceiptText className="text-pink-600" /><p className="mt-3 text-sm text-slate-500">Tiền mặt ca gần nhất</p><p className="text-2xl font-black">{money(paidSummary?.cashSales)}</p></div>
            <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Calculator className="text-blue-600" /><p className="mt-3 text-sm text-slate-500">Tiền kỳ vọng</p><p className="text-2xl font-black">{money(paidSummary?.expectedCash)}</p></div>
            <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Clock3 className="text-green-600" /><p className="mt-3 text-sm text-slate-500">Chênh lệch</p><p className="text-2xl font-black">{money(paidSummary?.difference)}</p></div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="mb-4 text-xl font-black">Lịch sử kết ca</h2>
            <div className="space-y-3">
              {history.map((shift) => (
                <div key={shift.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/70">
                  <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="font-black">{shift.status === 'OPEN' ? 'Ca đang mở' : 'Ca đã đóng'}</p>
                      <p className="text-sm text-slate-500">{new Date(shift.openedAt).toLocaleString('vi-VN')} {shift.closedAt ? `→ ${new Date(shift.closedAt).toLocaleString('vi-VN')}` : ''}</p>
                    </div>
                    <p className="rounded-full bg-white px-3 py-1 text-sm font-black dark:bg-slate-700">{shift.status}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-5">
                    <p>Đầu ca: <b>{money(shift.openingCash)}</b></p>
                    <p>Cash: <b>{money(shift.cashSales)}</b></p>
                    <p>QR/CK: <b>{money(Number(shift.qrSales) + Number(shift.bankSales))}</b></p>
                    <p>Thẻ/Ví: <b>{money(Number(shift.cardSales) + Number(shift.eWalletSales))}</b></p>
                    <p>Chênh lệch: <b>{money(shift.difference)}</b></p>
                  </div>
                </div>
              ))}
              {history.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-500 dark:bg-slate-800">Chưa có ca nào.</p>}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
