'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, WandSparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Insight = { revenue30: number; bestSeller: string; suggestions: string[]; topProducts: Array<{ name: string; _sum: { quantity: number; total: string } }> };

export default function AiPage() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<Insight | null>(null);

  useEffect(() => { if (token) apiFetch<Insight>(`/ai/insights?branchId=${user?.branchId || ''}`, { token }).then(setData).catch(console.error); }, [token, user?.branchId]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-pink-500 p-8 text-white shadow-soft">
          <div className="flex items-center gap-3"><BrainCircuit size={36} /><p className="font-black uppercase tracking-wide">AI Operation Center</p></div>
          <h1 className="mt-4 max-w-3xl text-4xl font-black">Gợi ý nhập hàng, dự đoán doanh thu và cảnh báo bất thường</h1>
          <p className="mt-3 max-w-2xl text-white/80">Bản hiện tại tạo insight từ order, thanh toán và kho. Khi dữ liệu đủ lớn có thể nâng thành model forecast theo giờ/ngày.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><TrendingUp className="text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-500">Doanh thu 30 ngày</p><p className="text-2xl font-black">{Number(data?.revenue30 || 0).toLocaleString('vi-VN')}đ</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><WandSparkles className="text-pink-600" /><p className="mt-3 text-sm font-bold text-slate-500">Món nổi bật</p><p className="text-2xl font-black">{data?.bestSeller || '...'}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><BrainCircuit className="text-orange-600" /><p className="mt-3 text-sm font-bold text-slate-500">AI gợi ý</p><p className="text-2xl font-black">{data?.suggestions?.length || 0}</p></div>
        </div>
        <section className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <h2 className="text-xl font-black">Gợi ý vận hành hôm nay</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{(data?.suggestions || []).map((item, index) => <div key={index} className="rounded-3xl bg-slate-50 p-4 font-semibold leading-7 dark:bg-slate-800">{item}</div>)}</div>
        </section>
        <section className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <h2 className="text-xl font-black">Top sản phẩm 30 ngày</h2>
          <div className="mt-4 space-y-2">{data?.topProducts?.map((item) => <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-bold dark:bg-slate-800"><span>{item.name}</span><span>{item._sum.quantity || 0} món</span></div>)}</div>
        </section>
      </div>
    </AppShell>
  );
}
