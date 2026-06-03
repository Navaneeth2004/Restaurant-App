import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import type { ViewType, UserRole } from '../types';

interface NavItem { key: ViewType; label: string; roles: UserRole[]; }
const NAV: NavItem[] = [
  { key: 'waiter',  label: 'Waiter',  roles: ['admin','waiter'] },
  { key: 'kitchen', label: 'Kitchen', roles: ['admin','kitchen'] },
  { key: 'admin',   label: 'Admin',   roles: ['admin'] },
  { key: 'reports', label: 'Reports', roles: ['admin'] },
];

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

interface Props { view: ViewType; setView: (v: ViewType) => void; }

export default function TopBar({ view, setView }: Props) {
  const { user, logout } = useAuth();
  const settings = useSettings();
  const allowed  = NAV.filter(n => user?.role && n.roles.includes(user.role));
  const logoUrl  = (settings as any).logo_url as string | undefined;

  return (
    <header className="h-14 flex-shrink-0 flex items-center px-4 gap-2 border-b border-surface-border bg-surface-card">
      {/* Logo + Name */}
      <div className="flex items-center gap-2.5 mr-3 flex-shrink-0">
        {logoUrl
          ? <img src={`${API_BASE}${logoUrl}`} alt="logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-8 h-8 rounded-lg gradient-brand flex-shrink-0" />
        }
        <span className="font-display font-bold text-white text-sm tracking-tight hidden sm:block truncate max-w-[140px]">
          {settings.restaurant_name || 'POS'}
        </span>
      </div>

      <div className="w-px h-5 bg-surface-border mx-1 hidden sm:block flex-shrink-0" />

      {/* Nav */}
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {allowed.map(n => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              view === n.key
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-surface-raised border border-transparent'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="leading-none">
            <div className="text-xs font-medium text-white">{user?.name}</div>
            <div className="text-[10px] text-zinc-500 capitalize">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-raised transition-colors border border-transparent hover:border-surface-border"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
