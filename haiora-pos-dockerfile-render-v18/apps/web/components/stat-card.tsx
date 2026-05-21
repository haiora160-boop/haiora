import { LucideIcon } from 'lucide-react';

export function StatCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: LucideIcon }) {
  return (
    <div className="kv-panel rounded-md p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
          <h3 className="mt-2 truncate text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-blue-50 text-[var(--kv-primary)] dark:bg-slate-800">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{hint}</p>
    </div>
  );
}
