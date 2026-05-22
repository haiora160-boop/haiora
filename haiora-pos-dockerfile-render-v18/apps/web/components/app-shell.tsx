'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  ChefHat,
  Clock3,
  CreditCard,
  DollarSign,
  FileClock,
  FileText,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackagePlus,
  QrCode,
  Search,
  Settings2,
  ShoppingCart,
  Store,
  Sun,
  Table2,
  UserCircle,
  Users,
  WalletCards,
  X,
  Warehouse,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { themeOptions, useThemeStore } from '@/stores/theme-store';
import { apiFetch } from '@/lib/api';

const saleLinks = [
  { href: '/pos', label: 'Bán hàng', icon: ShoppingCart },
  { href: '/kitchen', label: 'Bếp / Bar', icon: ChefHat },
  { href: '/payments', label: 'Thanh toán', icon: CreditCard },
  { href: '/chat', label: 'Chat công việc', icon: MessageCircle },
  { href: '/invoices', label: 'Hóa đơn', icon: FileText, adminOnly: true },
  { href: '/shifts', label: 'Kết ca', icon: WalletCards },
];

const manageLinks = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Hàng hóa', icon: PackagePlus, adminOnly: true },
  { href: '/admin/tables', label: 'Phòng / bàn', icon: Table2, adminOnly: true },
  { href: '/inventory', label: 'Kho', icon: Warehouse, adminOnly: true },
  { href: '/crm', label: 'Khách hàng', icon: HeartHandshake },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3 },
];

const systemLinks = [
  { href: '/admin/staff', label: 'Nhân viên', icon: Users, adminOnly: true },
  { href: '/admin/hr', label: 'Chấm công', icon: Clock3, adminOnly: true },
  { href: '/admin/audit-logs', label: 'Nhật ký', icon: FileClock, adminOnly: true },
  { href: '/salary', label: 'Lương', icon: DollarSign },
  { href: '/self-order', label: 'QR order', icon: QrCode },
  { href: '/ai', label: 'AI', icon: BrainCircuit, adminOnly: true },
  { href: '/settings/themes', label: 'Giao diện & slogan', icon: Settings2, adminOnly: true },
  { href: '/profile', label: 'Hồ sơ', icon: UserCircle },
];

function canManage(role?: string) {
  return role === 'OWNER' || role === 'SUPER_ADMIN';
}

function initials(name?: string) {
  return (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function SidebarGroup({ title, links, pathname, canSeeAdmin }: { title: string; links: typeof saleLinks; pathname: string; canSeeAdmin: boolean }) {
  const visibleLinks = links.filter((link) => !('adminOnly' in link) || !link.adminOnly || canSeeAdmin);
  return (
    <div className="mt-4">
      <p className="px-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-2 space-y-1">
        {visibleLinks.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                active
                  ? 'bg-[var(--kv-primary)] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-[var(--kv-primary)] dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon size={18} className={active ? 'text-white' : 'text-slate-400 group-hover:text-[var(--kv-primary)]'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


const mobilePrimaryLinks = [
  { href: '/pos', label: 'Bán hàng', icon: ShoppingCart },
  { href: '/kitchen', label: 'Bếp', icon: ChefHat },
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/profile', label: 'Hồ sơ', icon: UserCircle },
];

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobilePrimaryLinks.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition ${
                active
                  ? 'bg-[var(--kv-primary)] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileDrawer({ open, onClose, pathname, canSeeAdmin }: { open: boolean; onClose: () => void; pathname: string; canSeeAdmin: boolean }) {
  const groups = [
    { title: 'Bán hàng', links: saleLinks },
    { title: 'Quản lý', links: manageLinks },
    { title: 'Hệ thống', links: systemLinks },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button aria-label="Đóng menu" onClick={onClose} className="absolute inset-0 bg-slate-950/45" />
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ duration: 0.2 }}
        className="relative h-full w-[86vw] max-w-sm overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50">
              <Image src="/logo-haiora.png" alt="HAIORA POS" width={44} height={44} className="h-10 w-10 object-contain" />
            </div>
            <div>
              <p className="text-lg font-black">HAIORA POS</p>
              <p className="text-xs font-bold text-slate-500">Menu điện thoại</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">{group.title}</p>
              <div className="mt-2 grid gap-2">
                {group.links
                  .filter((link) => !('adminOnly' in link) || !link.adminOnly || canSeeAdmin)
                  .map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-sm font-black ${
                          active ? 'bg-[var(--kv-primary)] text-white' : 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <item.icon size={20} />
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const activeTheme = themeOptions.find((item) => item.value === theme) || themeOptions[0];
  const [branding, setBranding] = useState<{ appName: string; slogans: string[] }>({ appName: 'stype pos', slogans: [] });
  const [sloganIndex, setSloganIndex] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const canSeeAdmin = canManage(user?.role);
  const isPos = pathname === '/pos';
  const pageTitle = useMemo(() => {
    const allLinks = [...saleLinks, ...manageLinks, ...systemLinks];
    return allLinks.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label || 'Quản lý bán hàng';
  }, [pathname]);


  useEffect(() => {
    if (!token) return;
    apiFetch<{ appName: string; slogans: string[] }>('/settings/branding', { token })
      .then((data) => setBranding({ appName: data.appName || 'stype pos', slogans: data.slogans || [] }))
      .catch(() => setBranding({ appName: 'stype pos', slogans: [] }));
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setSloganIndex((value) => value + 1), 2600);
    return () => window.clearInterval(timer);
  }, []);

  const liveSlogan = branding.slogans.length ? branding.slogans[sloganIndex % branding.slogans.length] : activeTheme.slogan;

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
  }, [theme]);

  function toggleDark() {
    document.documentElement.classList.toggle('dark');
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <header className="fixed left-0 right-0 top-0 z-40 h-14 bg-[var(--kv-primary)] text-white shadow-md">
        <div className="flex h-full items-center gap-3 px-3">
          <Link href="/dashboard" className="flex min-w-[210px] items-center gap-2">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white shadow-sm">
              <Image src="/logo-haiora.png" alt="HAIORA POS" width={36} height={36} className="h-8 w-8 object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black uppercase tracking-wide">{branding.appName}</p>
              <p className="text-[11px] text-white/75">POS SaaS F&amp;B realtime</p>
            </div>
          </Link>

          <div className="hidden h-10 flex-1 items-center overflow-hidden rounded-md bg-white/15 px-3 lg:flex">
            <Search size={18} className="mr-2 text-white/80" />
            <input
              placeholder="Tìm món, hóa đơn, khách hàng, nhân viên..."
              className="w-full bg-transparent text-sm font-medium text-white placeholder:text-white/75 outline-none"
            />
            <span className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold">F3</span>
          </div>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as any)}
              className="h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-bold outline-none"
            >
              {themeOptions.map((item) => (
                <option key={item.value} value={item.value} className="text-slate-900">
                  {item.label}
                </option>
              ))}
            </select>
            <button className="grid h-10 w-10 place-items-center rounded-md bg-white/10 hover:bg-white/20">
              <Bell size={18} />
            </button>
            <button onClick={toggleDark} className="grid h-10 w-10 place-items-center rounded-md bg-white/10 hover:bg-white/20">
              <Moon size={17} />
            </button>
            <Link href="/profile" className="flex h-10 items-center gap-2 rounded-md bg-white/10 px-2 hover:bg-white/20">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white font-black text-[var(--kv-primary)]">{initials(user?.fullName)}</span>
              )}
              <span className="max-w-[120px] truncate text-sm font-bold">{user?.fullName || 'Demo'}</span>
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="grid h-10 w-10 place-items-center rounded-md bg-red-500/90 hover:bg-red-600"
            >
              <LogOut size={18} />
            </button>
          </div>
          <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-md bg-white/10 md:hidden" aria-label="Mở menu">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} canSeeAdmin={canSeeAdmin} />

      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-[var(--kv-primary)]" />
            <div>
              <p className="text-xs font-bold text-slate-500">Chi nhánh hiện tại</p>
              <p className="text-sm font-black">Trung tâm</p>
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, repeat: Infinity, repeatType: 'reverse' }}
            className="slogan-live mt-3 text-xs font-black text-[var(--kv-primary)]"
          >
            {liveSlogan}
          </motion.p>
        </div>

        <SidebarGroup title="Bán hàng" links={saleLinks} pathname={pathname} canSeeAdmin={canSeeAdmin} />
        <SidebarGroup title="Quản lý" links={manageLinks} pathname={pathname} canSeeAdmin={canSeeAdmin} />
        <SidebarGroup title="Hệ thống" links={systemLinks} pathname={pathname} canSeeAdmin={canSeeAdmin} />

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <div className="flex items-center gap-2 font-black text-slate-700 dark:text-white">
            <Home size={15} /> Workspace riêng
          </div>
          <p className="mt-1">Mỗi quán/chi nhánh tách dữ liệu theo tenant, phù hợp bán SaaS.</p>
        </div>
      </aside>

      <main className={`pb-24 pt-14 lg:pb-0 ${isPos ? 'lg:pl-0' : 'lg:pl-60'}`}>
        {!isPos && (
          <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kv-primary)]">Quản trị bán hàng</p>
                <h1 className="text-xl font-black">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Sun size={16} /> Realtime · Responsive · Multi-branch
              </div>
            </div>
          </div>
        )}
        <div className={isPos ? '' : 'p-4'}>{children}</div>
      </main>
      <MobileBottomNav pathname={pathname} />
    </div>
  );
}
