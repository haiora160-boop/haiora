import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './stores/**/*.{ts,tsx}'],
  safelist: [
    'from-pink-500', 'via-fuchsia-600', 'to-indigo-600',
    'from-amber-500', 'via-orange-600', 'to-rose-600',
    'from-cyan-500', 'via-blue-600', 'to-indigo-700',
    'from-slate-800', 'via-purple-700', 'to-pink-700',
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 20px 60px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
