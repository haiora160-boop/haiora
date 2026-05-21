'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellRing,
  CheckCircle2,
  CreditCard,
  FileText,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  StickyNote,
  Table2,
  Truck,
  UsersRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { Product, usePosStore } from '@/stores/pos-store';

type Area = { id: string; name: string; tables: Array<{ id: string; name: string; status: string }> };
type Bootstrap = { areas: Area[]; products: Product[]; categories: Array<{ id: string; name: string }> };

type OfflineOrder = {
  localId?: string;
  createdAt?: string;
  branchId?: string;
  tableId?: string;
  note?: string;
  items: Array<{ productId: string; quantity: number; note?: string }>;
};

type OfflineSyncResult = { localId: string; status: string; message?: string };
type Order = {
  id: string;
  code: string;
  total: string | number;
  status: string;
  paymentStatus: string;
  table?: { id: string; name: string } | null;
  receiptNo?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  items: Array<{ id: string; name: string; quantity: number; price?: string | number; total?: string | number; note?: string | null }>;
};

const paymentMethods = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'QR', label: 'QR' },
  { value: 'CARD', label: 'Thẻ' },
  { value: 'E_WALLET', label: 'Ví điện tử' },
];

const sellModes = [
  { value: 'TABLE', label: 'Tại quán', icon: Table2 },
  { value: 'TAKEAWAY', label: 'Mang về', icon: Truck },
  { value: 'DELIVERY', label: 'Giao đi', icon: UsersRound },
];

function money(value: string | number) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function statusLabel(status: string) {
  if (status === 'OCCUPIED') return 'Có khách';
  if (status === 'RESERVED') return 'Đặt trước';
  if (status === 'CLEANING') return 'Dọn bàn';
  return 'Trống';
}

export default function PosPage() {
  const { token, user } = useAuthStore();
  const { items, tableId, tableName, orderNote, setTable, setOrderNote, addProduct, increase, decrease, updateItemNote, clear } = usePosStore();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [category, setCategory] = useState<string>('ALL');
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('CASH');
  const [bellMessage, setBellMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('TABLE');
  const [tab, setTab] = useState<'MENU' | 'TABLES'>('MENU');
  const [billTool, setBillTool] = useState<'SPLIT' | 'MERGE' | 'MOVE' | null>(null);
  const [splitItemIds, setSplitItemIds] = useState<string[]>([]);
  const [targetOrderId, setTargetOrderId] = useState('');
  const [targetTableId, setTargetTableId] = useState('');

  function playBell(message: string) {
    setBellMessage(message);
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Browser có thể chặn audio nếu người dùng chưa tương tác.
    }
    window.setTimeout(() => setBellMessage(''), 6500);
  }

  async function reload() {
    if (!token || !user?.branchId) return;
    const [bootstrap, orderList] = await Promise.all([
      apiFetch<Bootstrap>(`/pos/bootstrap?branchId=${user.branchId}`, { token }),
      apiFetch<Order[]>(`/orders?branchId=${user.branchId}`, { token }),
    ]);
    setData(bootstrap);
    setOrders(orderList);
  }

  function loadOfflineQueue(): OfflineOrder[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem('pos-offline-orders') || '[]');
      return Array.isArray(parsed) ? (parsed as OfflineOrder[]) : [];
    } catch {
      return [];
    }
  }

  function saveOfflineQueue(queue: OfflineOrder[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pos-offline-orders', JSON.stringify(queue));
    setQueueCount(queue.length);
  }

  function queueOfflineOrder(payload: OfflineOrder) {
    const queue = loadOfflineQueue();
    const localOrder: OfflineOrder = {
      ...payload,
      localId: `LOCAL-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      createdAt: new Date().toISOString(),
    };
    saveOfflineQueue([...queue, localOrder]);
    clear();
    setIsOffline(true);
    setMessage(`Mất mạng/API. Đã lưu order offline ${localOrder.localId}. Khi có mạng bấm Đồng bộ.`);
  }

  async function syncOfflineOrders() {
    if (!token || !user?.branchId) return;
    const queue = loadOfflineQueue();
    setQueueCount(queue.length);
    if (queue.length === 0) return setMessage('Không có order offline cần đồng bộ.');
    try {
      const response = await apiFetch<{ results: OfflineSyncResult[] }>('/pos/offline-sync', {
        method: 'POST',
        token,
        body: JSON.stringify({ orders: queue.map((item: OfflineOrder) => ({ ...item, branchId: item.branchId || user.branchId })) }),
      });
      const failedIds = response.results.filter((item: OfflineSyncResult) => item.status === 'FAILED').map((item: OfflineSyncResult) => item.localId);
      saveOfflineQueue(queue.filter((item: OfflineOrder) => item.localId && failedIds.includes(item.localId)));
      setIsOffline(failedIds.length > 0);
      setMessage(failedIds.length ? `Đã đồng bộ một phần. Còn ${failedIds.length} order lỗi.` : 'Đã đồng bộ toàn bộ order offline.');
      await reload();
    } catch (error: any) {
      setIsOffline(true);
      setMessage(error.message || 'Chưa đồng bộ được order offline');
    }
  }

  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    setQueueCount(loadOfflineQueue().length);
    const onlineHandler = () => setIsOffline(false);
    const offlineHandler = () => setIsOffline(true);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    if (!token || !user?.branchId) return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); };
    const socket = getSocket();
    socket.emit('joinBranch', { tenantId: user.tenantId, branchId: user.branchId });
    const onRefresh = () => reload().catch(console.error);
    socket.on('table.status_changed', onRefresh);
    socket.on('order.created', onRefresh);
    socket.on('order.paid', onRefresh);
    socket.on('order.ready', (payload: any) => {
      playBell(payload?.message || 'Bếp đã hoàn thành món');
      onRefresh();
    });
    reload().catch(console.error);
    return () => {
      socket.off('table.status_changed', onRefresh);
      socket.off('order.created', onRefresh);
      socket.off('order.paid', onRefresh);
      socket.off('order.ready');
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, [token, user?.branchId, user?.tenantId]);

  const products = useMemo(() => {
    if (!data) return [];
    const byCategory = category === 'ALL' ? data.products : data.products.filter((p) => p.category?.id === category);
    if (!query.trim()) return byCategory;
    const normalized = query.toLowerCase();
    return byCategory.filter((p) => `${p.name} ${p.sku || ''}`.toLowerCase().includes(normalized));
  }, [data, category, query]);

  const tables = useMemo(() => data?.areas.flatMap((area) => area.tables.map((table) => ({ ...table, areaName: area.name }))) || [], [data]);
  const unpaidOrders = orders.filter((order) => order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED');
  const selectedTableOpenOrder = tableId ? unpaidOrders.find((order) => order.table?.id === tableId) || null : null;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  async function submitOrder() {
    if (!token || !user?.branchId) return;
    if (items.length === 0) return setMessage('Bạn chưa chọn món');
    if (mode === 'TABLE' && !tableId) return setMessage('Vui lòng chọn bàn trước khi gửi order.');
    const payload: OfflineOrder = {
      branchId: user.branchId,
      tableId: mode === 'TABLE' ? tableId : undefined,
      note: [mode !== 'TABLE' ? sellModes.find((item) => item.value === mode)?.label : '', orderNote].filter(Boolean).join(' · '),
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, note: item.note })),
    };
    try {
      const keepTableId = tableId;
      const keepTableName = tableName;
      await apiFetch('/pos/orders', { method: 'POST', token, body: JSON.stringify(payload) });
      clear();
      if (mode === 'TABLE' && keepTableId && keepTableName) setTable(keepTableId, keepTableName);
      setIsOffline(false);
      setMessage('Đã gửi order xuống bếp/bar realtime. Nếu bàn đã có bill mở, món sẽ được cộng vào bill của bàn đó.');
      await reload();
    } catch {
      queueOfflineOrder(payload);
    }
  }

  function openReceipt(orderId: string, type: 'temp' | 'paid' = 'paid') {
    window.open(`/print/invoice/${orderId}?type=${type}`, '_blank', 'width=420,height=760');
  }

  function printTempBill() {
    if (!selectedTableOpenOrder) return setMessage('Bàn đang chọn chưa có bill để in tạm tính.');
    openReceipt(selectedTableOpenOrder.id, 'temp');
  }

  async function payOrder(order: Order) {
    if (!token) return;
    try {
      await apiFetch(`/pos/orders/${order.id}/payment`, {
        method: 'POST',
        token,
        body: JSON.stringify({ method, amount: Number(order.total) }),
      });
      setMessage(`Đã thanh toán ${order.table?.name ? `${order.table.name} · ` : ''}${order.code}. Đang mở hóa đơn in nhiệt.`);
      openReceipt(order.id, 'paid');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không thanh toán được');
    }
  }

  async function paySelectedTable() {
    if (!selectedTableOpenOrder) return setMessage('Bàn đang chọn chưa có bill mở để thanh toán.');
    await payOrder(selectedTableOpenOrder);
  }

  function openBillTool(tool: 'SPLIT' | 'MERGE' | 'MOVE') {
    if (!selectedTableOpenOrder) return setMessage('Bạn cần chọn bàn đang có bill mở trước.');
    setBillTool(tool);
    setSplitItemIds(selectedTableOpenOrder.items.map((item) => item.id));
    setTargetOrderId('');
    setTargetTableId('');
  }

  async function submitSplitBill() {
    if (!token || !selectedTableOpenOrder) return;
    if (splitItemIds.length === 0) return setMessage('Chọn ít nhất 1 món để tách bill.');
    try {
      await apiFetch(`/pos/orders/${selectedTableOpenOrder.id}/split-bill`, {
        method: 'POST',
        token,
        body: JSON.stringify({ itemIds: splitItemIds, note: `Tách bill từ ${selectedTableOpenOrder.code}` }),
      });
      setBillTool(null);
      setMessage('Đã tách bill. Bill mới sẽ xuất hiện trong danh sách chờ thanh toán.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không tách được bill');
    }
  }

  async function submitMergeBill() {
    if (!token || !selectedTableOpenOrder) return;
    if (!targetOrderId) return setMessage('Chọn bill đích để gộp vào.');
    if (targetOrderId === selectedTableOpenOrder.id) return setMessage('Không thể gộp bill vào chính nó.');
    try {
      await apiFetch(`/pos/orders/${selectedTableOpenOrder.id}/merge-bill`, {
        method: 'POST',
        token,
        body: JSON.stringify({ targetOrderId, reason: `Gộp bill ${selectedTableOpenOrder.code}` }),
      });
      setBillTool(null);
      setMessage('Đã gộp bill. Bill nguồn đã được đóng/hủy để tránh tính trùng.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không gộp được bill');
    }
  }

  async function submitMoveTable() {
    if (!token || !selectedTableOpenOrder) return;
    if (!targetTableId) return setMessage('Chọn bàn đích để chuyển.');
    try {
      const selected = tables.find((table) => table.id === targetTableId);
      await apiFetch(`/pos/orders/${selectedTableOpenOrder.id}/change-table`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ tableId: targetTableId, reason: `Chuyển từ ${selectedTableOpenOrder.table?.name || 'không bàn'} sang ${selected?.name || ''}` }),
      });
      if (selected) setTable(selected.id, selected.name);
      setBillTool(null);
      setMessage('Đã chuyển bàn thành công.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không chuyển được bàn');
    }
  }

  return (
    <AppShell>
      {bellMessage && (
        <div className="fixed right-5 top-20 z-50 flex items-center gap-3 rounded-lg bg-emerald-600 px-5 py-4 font-black text-white shadow-soft">
          <BellRing className="animate-bounce" /> {bellMessage}
        </div>
      )}

      {billTool && selectedTableOpenOrder && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[var(--kv-primary)]">Công cụ bill theo bàn</p>
                <h3 className="text-xl font-black">{billTool === 'SPLIT' ? 'Tách bill' : billTool === 'MERGE' ? 'Gộp bill' : 'Chuyển bàn'}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Bill hiện tại: {selectedTableOpenOrder.code} · {selectedTableOpenOrder.table?.name || 'Mang về'} · {money(selectedTableOpenOrder.total)}đ</p>
              </div>
              <button onClick={() => setBillTool(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black dark:bg-slate-800">Đóng</button>
            </div>

            {billTool === 'SPLIT' && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-500">Chọn món muốn tách sang bill mới.</p>
                <div className="mt-3 max-h-72 space-y-2 overflow-auto kv-scrollbar">
                  {selectedTableOpenOrder.items.map((item) => {
                    const checked = splitItemIds.includes(item.id);
                    return (
                      <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setSplitItemIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                          />
                          <span>
                            <b>{item.name}</b>
                            <p className="text-xs font-semibold text-slate-500">SL {item.quantity}{item.note ? ` · ${item.note}` : ''}</p>
                          </span>
                        </span>
                        <b>{money(item.total || 0)}đ</b>
                      </label>
                    );
                  })}
                </div>
                <button onClick={submitSplitBill} className="mt-4 w-full rounded-lg bg-[var(--kv-primary)] py-3 font-black text-white">Xác nhận tách bill</button>
              </div>
            )}

            {billTool === 'MERGE' && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-500">Gộp toàn bộ món của bill hiện tại vào bill đích.</p>
                <select value={targetOrderId} onChange={(event) => setTargetOrderId(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 font-bold outline-none dark:border-slate-700 dark:bg-slate-800">
                  <option value="">Chọn bill đích</option>
                  {unpaidOrders.filter((order) => order.id !== selectedTableOpenOrder.id).map((order) => (
                    <option key={order.id} value={order.id}>{order.code} · {order.table?.name || 'Mang về'} · {money(order.total)}đ</option>
                  ))}
                </select>
                <button onClick={submitMergeBill} className="mt-4 w-full rounded-lg bg-[var(--kv-primary)] py-3 font-black text-white">Xác nhận gộp bill</button>
              </div>
            )}

            {billTool === 'MOVE' && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-500">Chuyển bill đang mở sang bàn khác.</p>
                <select value={targetTableId} onChange={(event) => setTargetTableId(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 font-bold outline-none dark:border-slate-700 dark:bg-slate-800">
                  <option value="">Chọn bàn đích</option>
                  {tables.filter((table) => table.id !== selectedTableOpenOrder.table?.id).map((table) => (
                    <option key={table.id} value={table.id}>{table.areaName} · {table.name} · {statusLabel(table.status)}</option>
                  ))}
                </select>
                <button onClick={submitMoveTable} className="mt-4 w-full rounded-lg bg-[var(--kv-primary)] py-3 font-black text-white">Xác nhận chuyển bàn</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-[#e9eff5] text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-800 bg-[var(--kv-primary)] px-3 py-2 text-white">
          <button onClick={() => setTab('TABLES')} className={`rounded px-4 py-2 text-sm font-black ${tab === 'TABLES' ? 'bg-white text-[var(--kv-primary)]' : 'bg-white/10 hover:bg-white/20'}`}>Phòng / Bàn</button>
          <button onClick={() => setTab('MENU')} className={`rounded px-4 py-2 text-sm font-black ${tab === 'MENU' ? 'bg-white text-[var(--kv-primary)]' : 'bg-white/10 hover:bg-white/20'}`}>Thực đơn</button>
          <button className="rounded bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20">Đặt gọi món</button>
          <button className="rounded bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20">Giao đi</button>
          <div className="ml-auto flex min-w-[280px] flex-1 items-center rounded bg-white px-3 py-2 text-slate-900 md:max-w-lg">
            <Search size={18} className="mr-2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mặt hàng (F3)" className="w-full bg-transparent text-sm font-semibold outline-none" />
          </div>
          <div className={`flex items-center gap-2 rounded px-3 py-2 text-xs font-black ${isOffline ? 'bg-orange-500' : 'bg-emerald-500'}`}>
            {isOffline ? <WifiOff size={16} /> : <Wifi size={16} />} {isOffline ? 'OFFLINE' : 'ONLINE'} · {queueCount}
          </div>
          <button onClick={syncOfflineOrders} className="rounded bg-white/15 px-3 py-2 text-xs font-black hover:bg-white/25"><RefreshCw size={15} className="inline" /> Đồng bộ</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[260px_1fr_430px]">
          <aside className="hidden min-h-0 border-r border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
            <div className="border-b border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs font-black uppercase text-slate-400">Kiểu bán</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {sellModes.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setMode(item.value)}
                    className={`rounded-md border px-2 py-2 text-xs font-black ${mode === item.value ? 'border-[var(--kv-primary)] bg-blue-50 text-[var(--kv-primary)]' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}
                  >
                    <item.icon className="mx-auto mb-1" size={16} /> {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 kv-scrollbar">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-black">Sơ đồ bàn</h2>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800">{tableName || 'Mang về'}</span>
              </div>
              <div className="space-y-4">
                {data?.areas.map((area) => (
                  <div key={area.id}>
                    <p className="mb-2 rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-500 dark:bg-slate-800">{area.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {area.tables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => { setMode('TABLE'); setTable(table.id, table.name); }}
                          className={`h-16 rounded-md border text-left text-sm font-black transition ${
                            tableId === table.id
                              ? 'border-[var(--kv-primary)] bg-[var(--kv-primary)] px-3 text-white'
                              : table.status === 'OCCUPIED'
                                ? 'border-orange-300 bg-orange-50 px-3 text-orange-700'
                                : 'border-slate-200 bg-white px-3 hover:border-[var(--kv-primary)] hover:text-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800'
                          }`}
                        >
                          {table.name}
                          <p className="mt-1 text-[11px] font-bold opacity-70">{statusLabel(table.status)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950">
            <div className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex gap-2 overflow-x-auto pb-1 kv-scrollbar">
                <button onClick={() => setCategory('ALL')} className={`whitespace-nowrap rounded border px-3 py-2 text-sm font-black ${category === 'ALL' ? 'border-[var(--kv-primary)] bg-[var(--kv-primary)] text-white' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>Tất cả</button>
                {data?.categories.map((cat) => (
                  <button key={cat.id} onClick={() => setCategory(cat.id)} className={`whitespace-nowrap rounded border px-3 py-2 text-sm font-black ${category === cat.id ? 'border-[var(--kv-primary)] bg-[var(--kv-primary)] text-white' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>{cat.name}</button>
                ))}
              </div>
            </div>

            <div className="h-full overflow-auto p-3 pb-28 kv-scrollbar">
              {tab === 'TABLES' ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data?.areas.flatMap((area) => area.tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => { setMode('TABLE'); setTable(table.id, table.name); setTab('MENU'); }}
                      className={`rounded-lg border p-4 text-left shadow-sm ${table.status === 'OCCUPIED' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white hover:border-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-900'}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black">{table.name}</p>
                        <Table2 size={22} />
                      </div>
                      <p className="mt-2 text-sm font-bold opacity-70">{statusLabel(table.status)}</p>
                    </button>
                  )))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {products.map((product) => (
                    <motion.button
                      key={product.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => addProduct(product)}
                      className="group overflow-hidden rounded-md border border-slate-200 bg-white text-left shadow-sm transition hover:border-[var(--kv-primary)] hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="relative h-28 bg-slate-100 dark:bg-slate-800">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-3xl">☕</div>
                        )}
                        <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-black text-[var(--kv-primary)] shadow">+ Thêm</span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-[40px] text-sm font-black">{product.name}</p>
                        <p className="mt-1 text-sm font-black text-[var(--kv-primary)]">{money(product.price)}đ</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">{product.sku || product.category?.name || 'F&B'}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Phiếu tạm</p>
                  <h2 className="text-lg font-black">{tableName || sellModes.find((item) => item.value === mode)?.label || 'Mang về'}</h2>
                </div>
                <div className="rounded bg-[var(--kv-primary)] px-3 py-2 text-sm font-black text-white">{itemCount} món</div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={tableId || ''}
                  onChange={(event) => {
                    const selected = tables.find((table) => table.id === event.target.value);
                    if (selected) { setMode('TABLE'); setTable(selected.id, selected.name); }
                  }}
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Chọn bàn cho order</option>
                  {tables.map((table) => <option key={table.id} value={table.id}>{table.areaName} · {table.name} · {statusLabel(table.status)}</option>)}
                </select>
                <button onClick={() => { setMode('TAKEAWAY'); setTable('', ''); }} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-black dark:border-slate-700 dark:bg-slate-800">Mang về</button>
              </div>
              {selectedTableOpenOrder && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase text-amber-600">Bill đang mở của bàn</p>
                      <p className="font-black">{selectedTableOpenOrder.code} · {selectedTableOpenOrder.items.length} dòng món</p>
                    </div>
                    <p className="text-lg font-black text-amber-700">{money(selectedTableOpenOrder.total)}đ</p>
                  </div>
                  <div className="mt-2 max-h-20 overflow-auto text-xs font-semibold text-slate-600 kv-scrollbar">
                    {selectedTableOpenOrder.items.map((item) => (
                      <p key={item.id}>• {item.name} x {item.quantity}{item.note ? ` · ${item.note}` : ''}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-black">
                <button onClick={() => openBillTool('SPLIT')} className="rounded border border-slate-200 bg-white py-2 hover:border-[var(--kv-primary)] hover:text-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800">Tách bill</button>
                <button onClick={() => openBillTool('MERGE')} className="rounded border border-slate-200 bg-white py-2 hover:border-[var(--kv-primary)] hover:text-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800">Gộp bill</button>
                <button onClick={() => openBillTool('MOVE')} className="rounded border border-slate-200 bg-white py-2 hover:border-[var(--kv-primary)] hover:text-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800">Chuyển bàn</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 kv-scrollbar">
              {items.length === 0 && (
                <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <FileText className="mx-auto text-slate-300" size={44} />
                    <p className="mt-3 font-black text-slate-500">Chưa có món trong phiếu</p>
                    <p className="mt-1 text-sm text-slate-400">Chọn món bên trái để thêm nhanh vào order.</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.productId} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black"><span className="text-slate-400">{index + 1}.</span> {item.name}</p>
                        <p className="text-sm font-bold text-slate-500">{money(item.price)}đ</p>
                      </div>
                      <p className="font-black text-[var(--kv-primary)]">{money(item.price * item.quantity)}đ</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => decrease(item.productId)} className="grid h-8 w-8 place-items-center rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><Minus size={15} /></button>
                      <span className="w-9 text-center font-black">{item.quantity}</span>
                      <button onClick={() => increase(item.productId)} className="grid h-8 w-8 place-items-center rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><Plus size={15} /></button>
                      <div className="ml-auto text-xs font-bold text-slate-400">SL x Giá</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <StickyNote size={15} className="text-slate-400" />
                      <input value={item.note || ''} onChange={(event) => updateItemNote(item.productId, event.target.value)} placeholder="Ghi chú: ít đá, không đường..." className="w-full bg-transparent text-xs font-semibold outline-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <textarea value={orderNote || ''} onChange={(event) => setOrderNote(event.target.value)} placeholder="Ghi chú chung cho order" className="h-16 w-full rounded border border-slate-200 bg-slate-50 p-2 text-sm font-semibold outline-none focus:border-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800" />
              <div className="mt-3 space-y-2 text-sm font-bold">
                <div className="flex justify-between text-slate-500"><span>Tạm tính</span><span>{money(total)}đ</span></div>
                <div className="flex justify-between text-slate-500"><span>Giảm giá</span><span>0đ</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xl font-black dark:border-slate-800">
                  <span>Khách cần trả</span>
                  <span className="text-[var(--kv-primary)]">{money(total)}đ</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={submitOrder} className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700"><Send size={18} /> Gửi bếp</button>
                <button onClick={printTempBill} className="flex items-center justify-center gap-2 rounded-md bg-[var(--kv-primary)] py-3 font-black text-white hover:bg-[var(--kv-primary-dark)]"><Printer size={18} /> In tạm</button>
              </div>
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm font-black outline-none dark:border-slate-700 dark:bg-slate-900">
                    {paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <button onClick={paySelectedTable} className="mb-2 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
                  <CreditCard size={16} /> Thanh toán bàn đang chọn
                </button>
                <div className="max-h-28 space-y-1 overflow-auto kv-scrollbar">
                  {unpaidOrders.slice(0, 4).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-2 rounded bg-white p-2 text-sm dark:bg-slate-900">
                      <div>
                        <p className="font-black">{order.code} · {order.table?.name || 'Mang về'}</p>
                        <p className="text-xs font-bold text-slate-500">{money(order.total)}đ</p>
                      </div>
                      <div className="flex gap-1"><button onClick={() => openReceipt(order.id, 'temp')} className="flex items-center gap-1 rounded bg-slate-200 px-2 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-700 dark:text-white"><Printer size={14} /> In</button><button onClick={() => payOrder(order)} className="flex items-center gap-1 rounded bg-[var(--kv-primary)] px-2 py-1.5 text-xs font-black text-white"><CreditCard size={14} /> Thu</button></div>
                    </div>
                  ))}
                  {unpaidOrders.length === 0 && <p className="rounded bg-white p-2 text-xs font-bold text-slate-500 dark:bg-slate-900">Chưa có order chờ thanh toán.</p>}
                </div>
              </div>
              {message && <p className="mt-3 flex items-center gap-2 rounded bg-blue-50 p-2 text-xs font-bold text-blue-700 dark:bg-blue-950/30"><CheckCircle2 size={16} /> {message}</p>}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
