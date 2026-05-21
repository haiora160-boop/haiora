'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type InvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  note?: string | null;
};

type Invoice = {
  id: string;
  code: string;
  receiptNo: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  tableName: string;
  startedAt: string;
  paidAt?: string | null;
  printedAt: string;
  printCount: number;
  paymentQrDynamicUrl?: string | null;
  paymentQrAmount?: number;
  paymentQrContent?: string;
  tenant: {
    name: string;
    appName?: string;
    phone?: string | null;
    address?: string | null;
    paymentQrUrl?: string | null;
    paymentQrNote?: string | null;
    paymentQrBankCode?: string | null;
    paymentQrAccountNo?: string | null;
    paymentQrAccountName?: string | null;
    paymentQrTemplate?: string | null;
    dynamicPaymentQrUrl?: string | null;
    receiptHeaderLine?: string | null;
    receiptShopName?: string | null;
    receiptShopAddress?: string | null;
    receiptShopPhone?: string | null;
    receiptFooterNote?: string | null;
  };
  branch: { name: string; phone?: string | null; address?: string | null };
  cashier?: { fullName: string; email: string } | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Array<{ method: string; amount: number; reference?: string | null; createdAt: string }>;
  note?: string | null;
};

const methodLabels: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  QR: 'QR',
  CARD: 'Thẻ',
  E_WALLET: 'Ví điện tử',
};

function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function dateTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function shortName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export default function PrintInvoicePage() {
  const params = useParams<{ orderId: string }>();
  const [type] = useState<'temp' | 'paid'>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('type') === 'temp' ? 'temp' : 'paid'));
  const { token } = useAuthStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');


  useEffect(() => {
    if (!token || !params?.orderId) return;
    const endpoint = type === 'temp' ? `/invoices/${params.orderId}` : `/invoices/${params.orderId}/print`;
    apiFetch<Invoice>(endpoint, { method: type === 'temp' ? 'GET' : 'POST', token })
      .then((data: any) => setInvoice(data?.invoice || data))
      .catch((err: any) => setError(err.message || 'Không tải được hóa đơn'));
  }, [token, params?.orderId, type]);

  useEffect(() => {
    if (invoice) document.title = `${type === 'temp' ? 'Tạm tính' : 'Hóa đơn'} ${invoice.receiptNo}`;
  }, [invoice, type]);

  const isTemp = type === 'temp' || invoice?.paymentStatus !== 'PAID';
  const paymentText = useMemo(() => {
    if (!invoice?.payments?.length) return isTemp ? 'Chưa thanh toán' : '';
    return invoice.payments.map((payment) => methodLabels[payment.method] || payment.method).join(', ');
  }, [invoice?.payments, isTemp]);

  const receiptHeaderLine = invoice?.tenant.receiptHeaderLine || `In bởi ${invoice?.tenant.appName || 'stype pos'}`;
  const receiptShopName = invoice?.tenant.receiptShopName || invoice?.tenant.name || invoice?.branch.name || 'Tên quán';
  const receiptShopAddress = invoice?.tenant.receiptShopAddress || invoice?.tenant.address || invoice?.branch.address || 'Địa chỉ quán';
  const receiptShopPhone = invoice?.tenant.receiptShopPhone || invoice?.tenant.phone || invoice?.branch.phone || '';
  const receiptFooterLines = (invoice?.tenant.receiptFooterNote || 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const qrImageUrl = invoice?.paymentQrDynamicUrl || invoice?.tenant.dynamicPaymentQrUrl || invoice?.tenant.paymentQrUrl || '';
  const isDynamicQr = Boolean(invoice?.paymentQrDynamicUrl || invoice?.tenant.dynamicPaymentQrUrl);
  const qrNote = isDynamicQr
    ? 'QR đã tự điền số tiền và mã hóa đơn'
    : invoice?.tenant.paymentQrNote || 'Nội dung chuyển khoản: Mã hóa đơn';

  if (!token) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center font-bold">Vui lòng đăng nhập trước khi in hóa đơn.</div>;
  }

  if (error) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center font-bold text-red-600">{error}</div>;
  }

  if (!invoice) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center font-bold">Đang tải hóa đơn...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
      <style jsx global>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { width: 80mm; background: white !important; }
          .print-toolbar { display: none !important; }
          .receipt-paper { width: 80mm !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
        }
      `}</style>

      <div className="print-toolbar mx-auto mb-4 flex max-w-sm items-center justify-between gap-2">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black shadow-sm">
          <RotateCcw size={16} /> Quay lại
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm">
          <Printer size={16} /> In bill 80mm
        </button>
      </div>

      <section className="receipt-paper mx-auto w-[80mm] rounded-lg bg-white px-[4mm] py-[4mm] font-mono text-[12px] leading-tight shadow-xl">
        <div className="text-center">
          {receiptHeaderLine && <p className="text-[11px] italic">{receiptHeaderLine}</p>}
          <h1 className="mt-1 text-[20px] font-black uppercase tracking-wide">{receiptShopName}</h1>
          {receiptShopAddress && <p className="mt-1 text-[11px] uppercase">{receiptShopAddress}</p>}
          {receiptShopPhone && <p className="text-[12px] font-bold">{receiptShopPhone}</p>}
          {isTemp && <p className="mt-2 inline-block border border-black px-2 py-1 text-[12px] font-black">PHIẾU TẠM TÍNH</p>}
          <h2 className="mt-2 text-[20px] font-black uppercase">{isTemp ? 'TẠM TÍNH' : 'HÓA ĐƠN'} {invoice.tableName}</h2>
        </div>

        <div className="mt-3 space-y-1 text-[12px]">
          <div className="flex justify-between gap-2"><span>Giờ bắt đầu:</span><span>{dateTime(invoice.startedAt)}</span></div>
          {invoice.paidAt && <div className="flex justify-between gap-2"><span>Giờ thanh toán:</span><span>{dateTime(invoice.paidAt)}</span></div>}
        </div>

        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-black">
              <th className="py-1 text-left">Tên</th>
              <th className="py-1 text-center">SL</th>
              <th className="py-1 text-right">Giá</th>
              <th className="py-1 text-right">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-dotted border-slate-400 align-top">
                <td className="py-1 pr-1">
                  <div className="font-bold">{shortName(item.name, 20)}</div>
                  {item.note && <div className="text-[10px] italic">({item.note})</div>}
                </td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right">{money(item.price)}</td>
                <td className="py-1 text-right">{money(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between"><span>Tổng dịch vụ</span><span>{money(invoice.subtotal)}</span></div>
          {invoice.discount > 0 && <div className="flex justify-between"><span>Giảm giá</span><span>-{money(invoice.discount)}</span></div>}
          {invoice.tax > 0 && <div className="flex justify-between"><span>Thuế/phụ thu</span><span>{money(invoice.tax)}</span></div>}
          <div className="mt-1 flex items-end justify-between border-t border-black pt-2">
            <span className="font-black">Thanh toán</span>
            <span className="text-[28px] font-black leading-none">{money(invoice.total)}</span>
          </div>
        </div>

        <div className="mt-2 space-y-1 text-[12px]">
          <div className="flex justify-between"><span>Mã hóa đơn</span><span>{invoice.receiptNo}</span></div>
          <div className="flex justify-between"><span>Thu ngân</span><span>{invoice.cashier?.fullName || '---'}</span></div>
          <div className="flex justify-between"><span>Phương thức</span><span>{paymentText}</span></div>
          {invoice.printCount > 0 && !isTemp && <div className="text-center text-[10px]">Số lần in: {invoice.printCount}</div>}
        </div>

        {qrImageUrl && (
          <div className="mt-3 border-t border-dashed border-black pt-3 text-center">
            <p className="text-[11px] font-black">QUÉT QR THANH TOÁN</p>
            <img src={qrImageUrl} alt="QR thanh toán" className="mx-auto mt-2 h-[36mm] w-[36mm] object-contain" />
            <p className="mt-1 text-[10px] font-bold">{qrNote}</p>
            <p className="text-[10px] font-black">Số tiền: {money(invoice.paymentQrAmount || invoice.total)}đ</p>
            <p className="text-[10px] font-bold">Nội dung: {invoice.paymentQrContent || invoice.receiptNo}</p>
          </div>
        )}

        <div className="mt-4 text-center text-[12px] font-semibold">
          {receiptFooterLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
