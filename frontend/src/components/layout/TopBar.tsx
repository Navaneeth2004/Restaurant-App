import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import Icon from 'components/ui/base/Icon';
import ThemeToggle from 'components/ui/base/ThemeToggle';
import { API_ORIGIN } from 'config/env';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useAuth } from 'state/auth/useAuth';
import { useSettings } from 'state/settings/useSettings';

export interface NavEntry { key: string; label: string; locked: boolean }
interface Props { items: NavEntry[]; active: string; onSelect: (key: string) => void }

export default function TopBar({ items, active, onSelect }: Props) {
  const { user, logout } = useAuth();
  const settings = useSettings();
  const { isLocked } = useAdminLock();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {confirming && (
        <ConfirmDialog title="Log Out" message={`Log out of "${user?.name ?? ''}"? You will need to enter your PIN to log back in.`}
          confirmLabel="Log Out" cancelLabel="Stay Logged In"
          onConfirm={() => { setConfirming(false); void logout(); }} onCancel={() => setConfirming(false)} />
      )}
      <header className="h-14 flex-shrink-0 flex items-center px-4 gap-2 border-b border-surface-border bg-surface-card">
        <div className="flex items-center gap-2.5 mr-3 flex-shrink-0">
          {settings.logo_url && <img src={`${API_ORIGIN}${settings.logo_url}`} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
          <span className="font-display font-bold text-white text-sm tracking-tight hidden sm:block truncate max-w-[140px]">{settings.restaurant_name || 'POS'}</span>
        </div>
        <div className="w-px h-5 bg-surface-border mx-1 hidden sm:block flex-shrink-0" />
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Main">
          {items.map(n => (
            <button key={n.key} type="button" onClick={() => onSelect(n.key)} aria-current={active === n.key ? 'page' : undefined}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 border ${active === n.key ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'text-zinc-400 hover:text-white hover:bg-surface-raised border-transparent'}`}>
              {n.label}
              {n.locked && isLocked && <Icon name="lock" className="w-3 h-3 text-amber-400 flex-shrink-0" strokeWidth={2.5} />}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">{user?.name.charAt(0).toUpperCase()}</div>
            <div className="leading-none">
              <div className="text-xs font-medium text-white">{user?.name}</div>
              <div className="text-[10px] text-zinc-500 capitalize">{user?.role}</div>
            </div>
          </div>
          <ThemeToggle />
          <button type="button" onClick={() => setConfirming(true)} className="text-xs text-zinc-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-raised transition-colors border border-transparent hover:border-surface-border">Log out</button>
        </div>
      </header>
    </>
  );
}
