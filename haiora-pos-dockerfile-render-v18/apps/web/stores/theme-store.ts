'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminTheme =
  | 'haioraGold'
  | 'stypeBlue'
  | 'coffeeGold'
  | 'mintFresh'
  | 'purplePro'
  | 'darkLuxury'
  | 'sunsetBar'
  | 'oceanPro'
  | 'roseMilk'
  | 'graphiteGold'
  | 'limeTea'
  | 'skyClean';

type ThemeState = {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
};

export const themeOptions: Array<{
  value: AdminTheme;
  label: string;
  slogan: string;
  primary: string;
  accent: string;
  gradient: string;
  logoSync?: boolean;
}> = [
  {
    value: 'haioraGold',
    label: 'HAIORA Gold Sync',
    slogan: 'Đồng bộ màu vàng nâu sang trọng theo logo HAIORA',
    primary: '#6b3f00',
    accent: '#f6b400',
    gradient: 'from-[#3b2200] via-[#b7791f] to-[#f7c948]',
    logoSync: true,
  },
  {
    value: 'stypeBlue',
    label: 'Stype Blue',
    slogan: 'Sạch – nhanh – dễ bán cho mọi ca',
    primary: '#006dca',
    accent: '#16a34a',
    gradient: 'from-blue-600 via-sky-500 to-emerald-400',
  },
  {
    value: 'coffeeGold',
    label: 'Coffee Gold',
    slogan: 'Ấm áp cho quán cà phê và trà sữa',
    primary: '#92400e',
    accent: '#f59e0b',
    gradient: 'from-amber-800 via-orange-500 to-yellow-400',
  },
  {
    value: 'mintFresh',
    label: 'Mint Fresh',
    slogan: 'Tươi sáng cho trà sữa, bakery, mô hình trẻ',
    primary: '#0f766e',
    accent: '#22c55e',
    gradient: 'from-teal-600 via-emerald-500 to-lime-400',
  },
  {
    value: 'purplePro',
    label: 'Purple Pro',
    slogan: 'Nổi bật cho lounge, beer club, mô hình hiện đại',
    primary: '#7c3aed',
    accent: '#ec4899',
    gradient: 'from-violet-700 via-purple-500 to-pink-400',
  },
  {
    value: 'darkLuxury',
    label: 'Dark Luxury',
    slogan: 'Sang trọng cho quán đêm, karaoke, bida, bar',
    primary: '#0f172a',
    accent: '#38bdf8',
    gradient: 'from-slate-950 via-slate-800 to-cyan-500',
  },
  {
    value: 'sunsetBar',
    label: 'Sunset Bar',
    slogan: 'Rực rỡ cho mô hình F&B trẻ và sự kiện',
    primary: '#ea580c',
    accent: '#f43f5e',
    gradient: 'from-orange-600 via-rose-500 to-pink-500',
  },
  {
    value: 'oceanPro',
    label: 'Ocean Pro',
    slogan: 'Xanh biển chuyên nghiệp, dễ nhìn trên tablet POS',
    primary: '#0369a1',
    accent: '#06b6d4',
    gradient: 'from-sky-700 via-cyan-500 to-teal-300',
  },
  {
    value: 'roseMilk',
    label: 'Rose Milk',
    slogan: 'Ngọt nhẹ cho trà sữa, dessert và mô hình nữ tính',
    primary: '#be185d',
    accent: '#fb7185',
    gradient: 'from-pink-700 via-rose-400 to-orange-200',
  },
  {
    value: 'graphiteGold',
    label: 'Graphite Gold',
    slogan: 'Đen vàng cao cấp cho mô hình premium',
    primary: '#1f2937',
    accent: '#f59e0b',
    gradient: 'from-zinc-900 via-stone-700 to-amber-400',
  },
  {
    value: 'limeTea',
    label: 'Lime Tea',
    slogan: 'Xanh chanh năng động cho trà chanh, fast drink',
    primary: '#3f6212',
    accent: '#a3e635',
    gradient: 'from-lime-800 via-green-500 to-lime-300',
  },
  {
    value: 'skyClean',
    label: 'Sky Clean',
    slogan: 'Sáng sạch, phù hợp quán ăn gia đình và chuỗi nhỏ',
    primary: '#2563eb',
    accent: '#60a5fa',
    gradient: 'from-blue-700 via-blue-400 to-sky-200',
  },
];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'haioraGold',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'stype-pos-admin-theme' },
  ),
);
