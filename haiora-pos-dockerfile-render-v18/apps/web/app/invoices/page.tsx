'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, Pencil, Printer, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type InvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
  total: number | string;
  note?: string | null;
};

type Invoice = {
  id: string;
  code: string;
  receiptNo?: string | null;
  status: string;
  paymentStatus: string;
  serviceType?: string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
  table?: { id: string; name: string } | null;
  cashier?: { id: string; fullName: string; email: string } | null;
  payments: Array<{ id: string; method: string; amount: number | string; createdAt: string }>;
  items: InvoiceItem[];
};

type EditableItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  note: string;
};

function money(value: string | number | undefined | null) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function dateText(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export default function InvoicesPage() {
  const { token, user } = useAuthStore();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('PAID');
  const [message, setMessage] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [note, setNote] = useState('');
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  const canEdit = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';

  async function load() {
    if (!token) return;
    const params = new URLSearchParams();
    params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    const data = await apiFetch<Invoice[]>(`/invoices?${params.toString()}`, { token });
    setRows(data);
    if (selected) {
      const fresh = data.find((item) => item.id === selected.id) || null;
      if (fresh) selectInvoice(fresh);
    }
  }

  function selectInvoice(invoice: Invoice) {
    setSelected(invoice);
    setDiscount(Number(invoice.discount || 0));
    setTax(Number(invoice.tax || 0));
    setNote(invoice.note || '');
    setEditableItems(invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      note: item.note || '',
    })));
  }

  useEffect(() => {
    load().catch((error: Error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const summary = useMemo(() => {
    return rows.reduce((acc, invoice) => {
      acc.revenue += Number(invoice.total || 0);
      acc.count += 1;
      return acc;
    }, { revenue: 0, count: 0 });
  }, [rows]);

  async function saveInvoiceHeader() {
    if (!token || !selected) return;
    if (!canEdit) return setMessage('Chỉ chủ quán được sửa hóa đơn cũ.');
    try {
      await apiFetch(`/invoices/${selected.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ discount, tax, note }),
      });
      setMessage('Đã cập nhật thông tin hóa đơn.');
      await load();
    } catch (error: any) {
      setMessage(error.message || 'Không sửa được hóa đơn');
    }
  }

  async function saveInvoiceItem(item: EditableItem) {
    if (!token || !selected) return;
    if (!canEdit) return setMessage('Chỉ chủ quán được sửa món trong hóa đơn cũ.');
    try {
      await apiFetch(`/invoices/${selected.id}/items/${item.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name: item.name, quantity: Number(item.quantity), price: Number(item.price), note: item.note }),
      });
      setMessage('Đã cập nhật món trong hóa đơn.');
      await load();
    } catch (error: any) {
      setMessage(error.message || 'Không sửa được món');
    }
  }

  async function deleteInvoiceItem(itemId: string) {
    if (!token || !selected) return;
    if (!canEdit) return setMessage('Chỉ chủ quán được xóa món trong hóa đơn cũ.');
    if (!confirm('Xóa món này khỏi hóa đơn cũ? Số tiền hóa đơn sẽ được tính lại.')) return;
    try {
      await apiFetch(`/invoices/${selected.id}/items/${itemId}`, { method: 'DELETE', token });
      setMessage('Đã xóa món và tính lại hóa đơn.');
      await load();
    } catch (error: any) {
      setMessage(error.message || 'Không xóa được món');
    }
  }

  function openReceipt(invoice: Invoice) {
    window.open(`/print/invoice/${invoice.id}?type=paid`, '_blank', 'width=420,height=760');
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <p className="text-xs font-black uppercase text-slate-400">Tổng hóa đơn</p>
            <h2 className="mt-2 text-3xl font-black">{summary.count}</h2>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <p className="text-xs font-black uppercase text-slate-400">Tổng tiền theo danh sách</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--kv-primary)]">{money(summary.revenue)}đ</h2>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <p className="text-xs font-black uppercase text-slate-400">Quyền sửa hóa đơn</p>
            <h2 className="mt-2 text-xl font-black">{canEdit ? 'Chủ quán' : 'Chỉ được xem'}</h2>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[220px] flex-1 items-center rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <Search size={17} className="mr-2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hóa đơn" className="w-full bg-transparent text-sm font-semibold outline-none" />
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-800">
                <option value="ALL">Tất cả</option>
                <option value="PAID">Đã thanh toán</option>
                <option value="CANCELLED">Đã hủy</option>
                <option value="PENDING">Đang mở</option>
              </select>
              <button onClick={() => load().catch((error: Error) => setMessage(error.message))} className="rounded-lg bg-[var(--kv-primary)] px-3 py-2 font-black text-white"><RefreshCw size={17} /></button>
            </div>

            <div className="mt-4 max-h-[68vh] space-y-2 overflow-auto pr-1 kv-scrollbar">
              {rows.map((invoice) => {
                const active = selected?.id === invoice.id;
                return (
                  <button key={invoice.id} onClick={() => selectInvoice(invoice)} className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-[var(--kv-primary)] bg-blue-50 dark:bg-slate-800' : 'border-slate-200 bg-white hover:border-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-900'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black"><FileText className="mr-1 inline" size={16} /> {invoice.receiptNo || invoice.code}</p>
                        <p className="text-xs font-bold text-slate-500">{invoice.table?.name || 'Mang về'} · {dateText(invoice.paidAt || invoice.createdAt)}</p>
                      </div>
                      <p className="font-black text-[var(--kv-primary)]">{money(invoice.total)}đ</p>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">{invoice.items.length} dòng món · {invoice.paymentStatus}</p>
                  </button>
                );
              })}
              {rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">Chưa có hóa đơn trong bộ lọc này.</p>}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            {!selected && (
              <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-slate-300 text-center dark:border-slate-700">
                <div>
                  <FileText className="mx-auto text-slate-300" size={54} />
                  <p className="mt-3 font-black text-slate-500">Chọn một hóa đơn để xem chi tiết</p>
                </div>
              </div>
            )}

            {selected && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--kv-primary)]">Chi tiết hóa đơn</p>
                    <h2 className="text-2xl font-black">{selected.receiptNo || selected.code}</h2>
                    <p className="text-sm font-semibold text-slate-500">{selected.table?.name || 'Mang về'} · Thu ngân: {selected.cashier?.fullName || '-'}</p>
                  </div>
                  <button onClick={() => openReceipt(selected)} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-black text-white dark:bg-white dark:text-slate-900"><Printer size={18} /> In lại</button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-bold">Giảm giá
                    <input disabled={!canEdit} type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value || 0))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800" />
                  </label>
                  <label className="text-sm font-bold">Thuế / phụ thu
                    <input disabled={!canEdit} type="number" value={tax} onChange={(event) => setTax(Number(event.target.value || 0))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800" />
                  </label>
                  <label className="text-sm font-bold md:col-span-1">Ghi chú hóa đơn
                    <input disabled={!canEdit} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800" />
                  </label>
                </div>
                {canEdit && <button onClick={saveInvoiceHeader} className="flex items-center gap-2 rounded-lg bg-[var(--kv-primary)] px-4 py-2 font-black text-white"><Save size={18} /> Lưu thông tin hóa đơn</button>}

                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-[1.5fr_70px_110px_110px_80px] bg-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-500 dark:bg-slate-800">
                    <span>Món</span><span>SL</span><span>Giá</span><span>Tổng</span><span></span>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {editableItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1.5fr_70px_110px_110px_80px] items-center gap-2 px-3 py-2 text-sm">
                        <div className="space-y-1">
                          <input disabled={!canEdit} value={item.name} onChange={(event) => setEditableItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} className="w-full rounded border border-slate-200 px-2 py-1 font-bold outline-none disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-800" />
                          <input disabled={!canEdit} value={item.note} onChange={(event) => setEditableItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, note: event.target.value } : entry))} placeholder="Ghi chú" className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold outline-none disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-800" />
                        </div>
                        <input disabled={!canEdit} type="number" value={item.quantity} onChange={(event) => setEditableItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: Number(event.target.value || 1) } : entry))} className="rounded border border-slate-200 px-2 py-1 font-bold outline-none disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-800" />
                        <input disabled={!canEdit} type="number" value={item.price} onChange={(event) => setEditableItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price: Number(event.target.value || 0) } : entry))} className="rounded border border-slate-200 px-2 py-1 font-bold outline-none disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-800" />
                        <b>{money(item.quantity * item.price)}đ</b>
                        <div className="flex gap-1">
                          {canEdit && <button onClick={() => saveInvoiceItem(item)} className="rounded bg-emerald-600 p-2 text-white"><Pencil size={15} /></button>}
                          {canEdit && <button onClick={() => deleteInvoiceItem(item.id)} className="rounded bg-red-600 p-2 text-white"><Trash2 size={15} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ml-auto max-w-sm rounded-xl bg-slate-50 p-4 text-sm font-bold dark:bg-slate-800">
                  <div className="flex justify-between"><span>Tạm tính</span><span>{money(selected.subtotal)}đ</span></div>
                  <div className="mt-2 flex justify-between"><span>Giảm giá</span><span>{money(selected.discount)}đ</span></div>
                  <div className="mt-2 flex justify-between"><span>Thuế/phụ thu</span><span>{money(selected.tax)}đ</span></div>
                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-xl font-black dark:border-slate-700"><span>Tổng</span><span className="text-[var(--kv-primary)]">{money(selected.total)}đ</span></div>
                  <div className="mt-3 text-xs text-slate-500"><CreditCard className="mr-1 inline" size={14} /> Payment gần nhất: {selected.payments[0] ? `${selected.payments[0].method} · ${money(selected.payments[0].amount)}đ` : '-'}</div>
                </div>
              </div>
            )}
            {message && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
