'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, DollarSign, Package, ReceiptText, Sparkles, Utensils } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell } from '@/components/app-shell';
import { StatCard } from '@/components/stat-card';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type DashboardData = {
  revenueToday: number;
  revenueMonth: number;
  ordersToday: number;
  ordersMonth: number;
  topProducts: Array<{ name: string; _sum: { quantity: number; total: string } }>;
  aiInsight: string;
};

function money(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function DashboardPage() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!token || !user?.branchId) return;
    apiFetch<DashboardData>(`/reports/dashboard?branchId=${user.branchId}`, { token }).then(setData).catch(console.error);
  }, [token, user?.branchId]);

  const chartData = data?.topProducts?.map((p) => ({ name: p.name, quantity: p._sum.quantity || 0 })) || [];

  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Doanh thu hôm nay" value={money(data?.revenueToday || 0)} hint="Đơn đã thanh toán" icon={DollarSign} />
            <StatCard title="Doanh thu tháng" value={money(data?.revenueMonth || 0)} hint="Tất cả chi nhánh đang xem" icon={ReceiptText} />
            <StatCard title="Hóa đơn hôm nay" value={`${data?.ordersToday || 0}`} hint="Phiếu hoàn tất" icon={Utensils} />
            <StatCard title="Đơn tháng" value={`${data?.ordersMonth || 0}`} hint="Theo dữ liệu realtime" icon={Package} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_310px]">
            <div className="kv-panel rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--kv-primary)]">Báo cáo nhanh</p>
                  <h2 className="text-lg font-black">Top món bán chạy</h2>
                </div>
                <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 hover:border-[var(--kv-primary)] hover:text-[var(--kv-primary)] dark:border-slate-700 dark:text-slate-300">
                  Xem báo cáo
                </button>
              </div>
              <div className="mt-4 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" radius={[4, 4, 0, 0]} fill="var(--kv-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="kv-panel rounded-md p-4">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-[var(--kv-primary)] dark:bg-slate-800">
                  <Sparkles />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">AI Insight</p>
                  <h2 className="font-black">Gợi ý vận hành</h2>
                </div>
              </div>
              <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-semibold leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {data?.aiInsight || 'Đang chờ dữ liệu doanh thu để phân tích.'}
              </p>
              <div className="mt-4 space-y-2">
                {['Đẩy combo giờ cao điểm', 'Kiểm tra tồn kho nguyên liệu chính', 'Theo dõi món bán chậm'].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-bold dark:border-slate-700">
                    {item}
                    <ArrowUpRight size={16} className="text-[var(--kv-primary)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="kv-panel rounded-md p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Thông tin gian hàng</p>
            <h2 className="mt-1 text-lg font-black">Chi nhánh trung tâm</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800"><p className="text-slate-500">Trạng thái</p><b className="text-emerald-600">Đang hoạt động</b></div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-800"><p className="text-slate-500">Realtime</p><b className="text-[var(--kv-primary)]">Socket OK</b></div>
            </div>
          </div>
          <div className="kv-panel rounded-md p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Việc cần làm</p>
            <div className="mt-3 space-y-2 text-sm font-bold">
              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">Chốt ca cuối ngày</div>
              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">Kiểm kê nguyên liệu tồn thấp</div>
              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">Xem hóa đơn chưa thanh toán</div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
