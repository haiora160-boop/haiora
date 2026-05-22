'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  Utensils,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    tenantId?: string | null;
    branchId?: string | null;
  };
};

const features = [
  { icon: Store, title: 'Nhiều chi nhánh', desc: 'Quản lý tập trung' },
  { icon: Utensils, title: 'POS F&B', desc: 'Order tại bàn' },
  { icon: CreditCard, title: 'Thanh toán', desc: 'Tiền mặt, QR, ví' },
  { icon: BarChart3, title: 'Báo cáo', desc: 'Realtime dashboard' },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('owner@demo.vn');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAuth(data.accessToken, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Không đăng nhập được');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff7df_0,#f8fafc_34%,#e9eff5_100%)] text-slate-900">
      <div className="absolute left-[-10rem] top-[-10rem] h-80 w-80 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="absolute bottom-[-12rem] right-[-12rem] h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />

      <header className="relative z-10 border-b border-white/70 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <Image
                src="/logo-haiora.png"
                alt="HAIORA POS"
                width={64}
                height={64}
                className="h-11 w-11 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-black uppercase tracking-wide text-slate-950">HAIORA POS</p>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">Smart POS – Smart Business</p>
            </div>
          </div>

          <div className="hidden items-center gap-6 text-sm font-black text-slate-600 md:flex">
            <span>POS</span>
            <span>Kho</span>
            <span>Báo cáo</span>
            <span>Multi-tenant</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:grid-cols-[1fr_440px] lg:py-8">
        <section className="hidden lg:block">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-4 py-2 text-sm font-black text-amber-700 shadow-sm">
              <Sparkles size={16} />
              Phần mềm POS dành cho quán cà phê, nhà hàng và chuỗi F&amp;B
            </div>

            <div className="mt-8 flex justify-center lg:justify-start">
              <div className="rounded-[2rem] border border-white bg-white/80 p-6 shadow-2xl backdrop-blur">
                <Image
                  src="/logo-haiora.png"
                  alt="HAIORA Smart POS"
                  width={420}
                  height={420}
                  className="h-auto w-72 object-contain md:w-96"
                  priority
                />
              </div>
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-black leading-tight text-slate-950 md:text-5xl">
              Quản lý bán hàng, bàn, bếp, doanh thu và nhân viên trên một nền tảng trực quan.
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-slate-600">
              HAIORA POS hỗ trợ order tại bàn, thanh toán QR, bill nhiệt, báo cáo doanh thu, kho nguyên liệu,
              phân quyền nhân viên và vận hành realtime cho mô hình F&amp;B hiện đại.
            </p>
          </motion.div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
              >
                <item.icon className="text-amber-600" />
                <p className="mt-3 font-black text-slate-950">{item.title}</p>
                <p className="text-sm font-semibold text-slate-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto w-full max-w-md rounded-[1.5rem] border border-white bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-6"
        >
          <div className="flex flex-col items-center border-b border-slate-200 pb-5 text-center">
            <Image
              src="/logo-haiora.png"
              alt="HAIORA POS"
              width={150}
              height={150}
              className="h-auto w-32 object-contain"
              priority
            />
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Quản lý bán hàng HAIORA POS</p>
          </div>

          <label className="mt-6 block text-sm font-black text-slate-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            placeholder="Nhập email đăng nhập"
          />

          <label className="mt-4 block text-sm font-black text-slate-700">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            placeholder="Nhập mật khẩu"
          />

          {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}

          <button
            disabled={loading}
            className="mt-6 min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3 text-lg font-black text-white shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Vào hệ thống'}
          </button>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-black text-slate-900">
              <ReceiptText size={16} /> Tài khoản demo
            </div>
            <p className="mt-2"><b>Owner:</b> owner@demo.vn / Admin@123456</p>
            <p><b>Super Admin:</b> admin@possaas.vn / Admin@123456</p>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            <p className="font-black">Phần mềm được phát triển bởi Nguyễn Trọng Hải</p>
            <p className="mt-1 font-bold">SĐT: 0977544477</p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
            <ShieldCheck size={14} /> Bảo mật đăng nhập, dữ liệu tách riêng theo từng quán
          </div>
        </motion.form>
      </main>
    </div>
  );
}
