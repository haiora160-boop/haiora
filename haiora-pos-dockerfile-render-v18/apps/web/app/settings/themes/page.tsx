'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ImageUp, Palette, QrCode, Save, Sparkles, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { themeOptions, useThemeStore } from '@/stores/theme-store';
import { apiFetch } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth-store';

type Branding = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  appName: string;
  slogans: string[];
  commissionMinSales: number;
  paymentQrUrl?: string;
  paymentQrNote?: string;
  paymentQrBankCode?: string;
  paymentQrAccountNo?: string;
  paymentQrAccountName?: string;
  paymentQrTemplate?: string;
  receiptHeaderLine?: string;
  receiptShopName?: string;
  receiptShopAddress?: string;
  receiptShopPhone?: string;
  receiptFooterNote?: string;
};

export default function ThemeSettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { token, user } = useAuthStore();
  const [branding, setBranding] = useState<Branding>({
    shopName: '',
    shopAddress: '',
    shopPhone: '',
    appName: 'stype pos',
    slogans: ['Bán hàng nhanh – Chốt ca chuẩn'],
    commissionMinSales: 0,
    paymentQrUrl: '',
    paymentQrNote: 'Khách chỉ cần quét QR, số tiền và nội dung đã tự điền.',
    paymentQrBankCode: '',
    paymentQrAccountNo: '',
    paymentQrAccountName: '',
    paymentQrTemplate: 'compact2',
    receiptHeaderLine: 'In bởi stype pos',
    receiptShopName: '',
    receiptShopAddress: '',
    receiptShopPhone: '',
    receiptFooterNote: 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
  });
  const [message, setMessage] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);
  const canEdit = user?.role === 'OWNER';

  async function reload() {
    if (!token) return;
    const data = await apiFetch<Branding>('/settings/branding', { token });
    setBranding({
      shopName: data.shopName || '',
      shopAddress: data.shopAddress || '',
      shopPhone: data.shopPhone || '',
      appName: data.appName || 'stype pos',
      slogans: data.slogans?.length ? data.slogans : ['Bán hàng nhanh – Chốt ca chuẩn'],
      commissionMinSales: Number(data.commissionMinSales || 0),
      paymentQrUrl: data.paymentQrUrl || '',
      paymentQrNote: data.paymentQrNote || 'Khách chỉ cần quét QR, số tiền và nội dung đã tự điền.',
      paymentQrBankCode: data.paymentQrBankCode || '',
      paymentQrAccountNo: data.paymentQrAccountNo || '',
      paymentQrAccountName: data.paymentQrAccountName || '',
      paymentQrTemplate: data.paymentQrTemplate || 'compact2',
      receiptHeaderLine: data.receiptHeaderLine || `In bởi ${data.appName || 'stype pos'}`,
      receiptShopName: data.receiptShopName || data.shopName || '',
      receiptShopAddress: data.receiptShopAddress || data.shopAddress || '',
      receiptShopPhone: data.receiptShopPhone || data.shopPhone || '',
      receiptFooterNote: data.receiptFooterNote || 'Quý khách vui lòng kiểm tra lại hóa đơn\ntrước khi thanh toán.\nXin cảm ơn quý khách.\nHẹn gặp lại quý khách lần sau.',
    });
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, [token]);

  async function saveBranding(nextBranding = branding) {
    if (!token || !canEdit) return;
    try {
      const slogans = nextBranding.slogans.map((item) => item.trim()).filter(Boolean);
      const data = await apiFetch<Branding>('/settings/branding', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          shopName: nextBranding.shopName || '',
          shopAddress: nextBranding.shopAddress || '',
          shopPhone: nextBranding.shopPhone || '',
          appName: nextBranding.appName || 'stype pos',
          slogans,
          commissionMinSales: Number(nextBranding.commissionMinSales || 0),
          paymentQrUrl: nextBranding.paymentQrUrl || '',
          paymentQrNote: nextBranding.paymentQrNote || '',
          paymentQrBankCode: nextBranding.paymentQrBankCode || '',
          paymentQrAccountNo: nextBranding.paymentQrAccountNo || '',
          paymentQrAccountName: nextBranding.paymentQrAccountName || '',
          paymentQrTemplate: nextBranding.paymentQrTemplate || 'compact2',
          receiptHeaderLine: nextBranding.receiptHeaderLine || '',
          receiptShopName: nextBranding.receiptShopName || '',
          receiptShopAddress: nextBranding.receiptShopAddress || '',
          receiptShopPhone: nextBranding.receiptShopPhone || '',
          receiptFooterNote: nextBranding.receiptFooterNote || '',
        }),
      });
      setBranding({
        ...data,
        slogans: data.slogans?.length ? data.slogans : slogans,
        paymentQrUrl: data.paymentQrUrl || '',
        paymentQrNote: data.paymentQrNote || '',
        paymentQrBankCode: data.paymentQrBankCode || '',
        paymentQrAccountNo: data.paymentQrAccountNo || '',
        paymentQrAccountName: data.paymentQrAccountName || '',
        paymentQrTemplate: data.paymentQrTemplate || 'compact2',
        receiptHeaderLine: data.receiptHeaderLine || `In bởi ${data.appName || 'stype pos'}`,
        receiptShopName: data.receiptShopName || data.shopName || '',
        receiptShopAddress: data.receiptShopAddress || data.shopAddress || '',
        receiptShopPhone: data.receiptShopPhone || data.shopPhone || '',
        receiptFooterNote: data.receiptFooterNote || '',
      });
      setMessage('Đã lưu thông tin quán, nội dung bill, QR động theo số tiền và ngưỡng hoa hồng.');
    } catch (error: any) {
      setMessage(error.message || 'Không lưu được cài đặt');
    }
  }

  async function handleQrUpload(file?: File) {
    if (!file || !token || !canEdit) return;
    try {
      setUploadingQr(true);
      const url = await uploadImage(file, token, 'qrcodes');
      const next = { ...branding, paymentQrUrl: url };
      setBranding(next);
      await saveBranding(next);
      setMessage('Đã upload QR thanh toán dự phòng. Hãy nhập thêm ngân hàng/số tài khoản để tạo QR động theo số tiền bill.');
    } catch (error: any) {
      setMessage(error.message || 'Không upload được mã QR');
    } finally {
      setUploadingQr(false);
    }
  }

  function updateSlogan(index: number, value: string) {
    setBranding((prev) => {
      const slogans = [...prev.slogans];
      slogans[index] = value;
      return { ...prev, slogans };
    });
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm font-bold text-[var(--kv-primary)]">Chủ quán / Giao diện, slogan & QR thanh toán</p>
        <h1 className="text-3xl font-black">Tùy biến Stype POS</h1>
        <p className="mt-2 text-slate-500">Chỉnh tên quán, địa chỉ, giao diện, slogan động và QR thanh toán in kèm hóa đơn.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
        <section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {themeOptions.map((item) => {
              const active = item.value === theme;
              return (
                <button
                  key={item.value}
                  onClick={() => setTheme(item.value)}
                  className={`overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-1 ${active ? 'border-[var(--kv-primary)] bg-white dark:bg-slate-900' : 'border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80'}`}
                >
                  <div className={`grid h-32 place-items-center rounded-2xl bg-gradient-to-br ${item.gradient} text-white`}>
                    <Palette size={40} />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black">{item.label}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{item.slogan}</p>
                      {item.logoSync && <span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Đồng bộ logo HAIORA</span>}
                    </div>
                    {active && <CheckCircle2 className="text-green-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[var(--kv-primary)] dark:bg-slate-800"><Sparkles /></div>
              <div>
                <h2 className="font-black">Thông tin quán, tên app & slogan</h2>
                <p className="text-sm font-semibold text-slate-500">Chỉ chủ quán được chỉnh sửa. Tên quán và địa chỉ sẽ hiện trên hóa đơn/in bill.</p>
              </div>
            </div>

            <label className="text-sm font-black">Tên quán</label>
            <input disabled={!canEdit} value={branding.shopName} onChange={(e) => setBranding({ ...branding, shopName: e.target.value })} placeholder="VD: COFFEE BINBO" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

            <label className="mt-4 block text-sm font-black">Địa chỉ quán</label>
            <input disabled={!canEdit} value={branding.shopAddress} onChange={(e) => setBranding({ ...branding, shopAddress: e.target.value })} placeholder="Địa chỉ in trên hóa đơn" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

            <label className="mt-4 block text-sm font-black">Số điện thoại quán</label>
            <input disabled={!canEdit} value={branding.shopPhone} onChange={(e) => setBranding({ ...branding, shopPhone: e.target.value })} placeholder="Hotline in trên hóa đơn" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

            <label className="mt-4 block text-sm font-black">Tên app</label>
            <input disabled={!canEdit} value={branding.appName} onChange={(e) => setBranding({ ...branding, appName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="mb-3">
                <h3 className="font-black">Thông tin in trên bill nhiệt</h3>
                <p className="text-xs font-semibold text-slate-500">Phần này thay trực tiếp các dòng: “In bởi...”, tên quán, địa chỉ, số điện thoại và lời cảm ơn cuối bill.</p>
              </div>

              <label className="text-sm font-black">Dòng đầu bill</label>
              <input disabled={!canEdit} value={branding.receiptHeaderLine || ''} onChange={(e) => setBranding({ ...branding, receiptHeaderLine: e.target.value })} placeholder="VD: In bởi STYPE POS" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />

              <label className="mt-4 block text-sm font-black">Tên quán trên bill</label>
              <input disabled={!canEdit} value={branding.receiptShopName || ''} onChange={(e) => setBranding({ ...branding, receiptShopName: e.target.value })} placeholder="VD: KING COFFEE" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />

              <label className="mt-4 block text-sm font-black">Địa chỉ trên bill</label>
              <input disabled={!canEdit} value={branding.receiptShopAddress || ''} onChange={(e) => setBranding({ ...branding, receiptShopAddress: e.target.value })} placeholder="VD: Quận 1, TP.HCM" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />

              <label className="mt-4 block text-sm font-black">Số điện thoại trên bill</label>
              <input disabled={!canEdit} value={branding.receiptShopPhone || ''} onChange={(e) => setBranding({ ...branding, receiptShopPhone: e.target.value })} placeholder="VD: 0900000000" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />

              <label className="mt-4 block text-sm font-black">Lời cảm ơn cuối bill</label>
              <textarea disabled={!canEdit} value={branding.receiptFooterNote || ''} onChange={(e) => setBranding({ ...branding, receiptFooterNote: e.target.value })} rows={4} placeholder="Mỗi dòng sẽ in thành 1 dòng trên bill" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />
            </div>

            <label className="mt-4 block text-sm font-black">Ngưỡng hóa đơn được tính hoa hồng</label>
            <input disabled={!canEdit} type="number" value={branding.commissionMinSales} onChange={(e) => setBranding({ ...branding, commissionMinSales: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
            <p className="mt-1 text-xs font-semibold text-slate-500">Ví dụ: đặt 100000 thì hóa đơn từ 100.000đ trở lên mới phát sinh hoa hồng cho người gọi món.</p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black">Slogan chạy động</label>
                {canEdit && <button onClick={() => setBranding({ ...branding, slogans: [...branding.slogans, ''] })} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black dark:bg-slate-800">+ Thêm</button>}
              </div>
              {branding.slogans.map((slogan, index) => (
                <input key={index} disabled={!canEdit} value={slogan} onChange={(e) => updateSlogan(index, e.target.value)} placeholder={`Slogan ${index + 1}`} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
              ))}
            </div>

            <button disabled={!canEdit} onClick={() => saveBranding()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--kv-primary)] px-4 py-3 font-black text-white disabled:opacity-50">
              <Save size={18} /> Lưu cài đặt
            </button>
            {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-slate-800"><QrCode /></div>
              <div>
                <h2 className="font-black">QR thanh toán động theo số tiền bill</h2>
                <p className="text-sm font-semibold text-slate-500">Nhập thông tin tài khoản nhận tiền để bill tự tạo QR có sẵn số tiền và mã hóa đơn.</p>
              </div>
            </div>

            {branding.paymentQrUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                <img src={branding.paymentQrUrl} alt="QR thanh toán" className="mx-auto h-52 w-52 rounded-xl bg-white object-contain p-2" />
                <p className="mt-2 text-xs font-bold text-slate-500">QR upload dùng làm dự phòng. Nếu nhập đủ ngân hàng + số tài khoản, hóa đơn sẽ ưu tiên QR động có sẵn số tiền.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                <QrCode className="mx-auto text-slate-400" size={48} />
                <p className="mt-2 font-bold text-slate-500">Chưa upload QR thanh toán</p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <h3 className="font-black text-emerald-700 dark:text-emerald-300">Cấu hình QR động</h3>
              <p className="mt-1 text-xs font-semibold text-emerald-700/80 dark:text-emerald-200/80">Khi có đủ mã ngân hàng và số tài khoản, hóa đơn sẽ tự tạo QR theo đúng số tiền cần thanh toán. Khách quét QR sẽ không phải nhập lại số tiền.</p>

              <label className="mt-3 block text-sm font-black">Mã ngân hàng / BIN VietQR</label>
              <input disabled={!canEdit} value={branding.paymentQrBankCode || ''} onChange={(e) => setBranding({ ...branding, paymentQrBankCode: e.target.value })} placeholder="VD: VCB, ACB, MBBank hoặc 970436" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

              <label className="mt-3 block text-sm font-black">Số tài khoản nhận tiền</label>
              <input disabled={!canEdit} value={branding.paymentQrAccountNo || ''} onChange={(e) => setBranding({ ...branding, paymentQrAccountNo: e.target.value })} placeholder="VD: 0123456789" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

              <label className="mt-3 block text-sm font-black">Tên chủ tài khoản</label>
              <input disabled={!canEdit} value={branding.paymentQrAccountName || ''} onChange={(e) => setBranding({ ...branding, paymentQrAccountName: e.target.value })} placeholder="VD: NGUYEN VAN A" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold uppercase outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

              <label className="mt-3 block text-sm font-black">Mẫu QR</label>
              <select disabled={!canEdit} value={branding.paymentQrTemplate || 'compact2'} onChange={(e) => setBranding({ ...branding, paymentQrTemplate: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <option value="compact2">Compact 2 - gọn cho bill nhiệt</option>
                <option value="compact">Compact</option>
                <option value="qr_only">Chỉ QR</option>
                <option value="print">Print</option>
              </select>
            </div>

            <label className="mt-4 block text-sm font-black">Ghi chú QR</label>
            <input disabled={!canEdit} value={branding.paymentQrNote || ''} onChange={(e) => setBranding({ ...branding, paymentQrNote: e.target.value })} placeholder="VD: Khách chỉ cần quét QR, số tiền đã tự điền" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--kv-primary)] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white ${!canEdit || uploadingQr ? 'pointer-events-none opacity-60' : ''}`}>
                <ImageUp size={18} /> {uploadingQr ? 'Đang upload...' : 'Upload QR'}
                <input type="file" accept="image/*" className="hidden" disabled={!canEdit || uploadingQr} onChange={(event) => handleQrUpload(event.target.files?.[0])} />
              </label>
              <button disabled={!canEdit || !branding.paymentQrUrl} onClick={() => saveBranding({ ...branding, paymentQrUrl: '' })} className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-black text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-white">
                <Trash2 size={18} /> Xóa QR
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
