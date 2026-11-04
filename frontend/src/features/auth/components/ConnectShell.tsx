import { ReactNode } from 'react';
import ThemeToggle from 'components/ui/base/ThemeToggle';

export default function ConnectShell({ children, notice }: { children: ReactNode; notice?: string | null }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-20"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">Restaurant POS</h1>
          <p className="text-zinc-500 text-sm mt-1">Connect this device to your restaurant</p>
        </div>
        {notice && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">{notice}</div>
        )}
        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">{children}</div>
      </div>
    </div>
  );
}
