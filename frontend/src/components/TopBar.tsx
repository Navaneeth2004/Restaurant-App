import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAdminLock } from '../context/AdminLockContext';
import type { ViewType, UserRole } from '../types';

interface NavItem { key: ViewType; label: string; roles: UserRole[]; }
const NAV: NavItem[] = [
  { key: 'waiter',  label: 'Waiter',  roles: ['admin','waiter'] },
  { key: 'kitchen', label: 'Kitchen', roles: ['admin','kitchen'] },
  { key: 'admin',   label: 'Admin',   roles: ['admin'] },
  { key: 'reports', label: 'Reports', roles: ['admin'] },
];

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props { view: ViewType; setView: (v: ViewType) => void; }

export default function TopBar({ view, setView }: Props) {
  const { user, logout } = useAuth();
  const settings = useSettings();
  const { config, isLocked, lock } = useAdminLock();
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
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
              view === n.key
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-surface-raised border border-transparent'
            }`}
          >
            {n.label}
            {/* Lock indicator on admin tab */}
            {n.key === 'admin' && config.enabled && isLocked && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border border-surface-card flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {/* Lock button — only for admin users when lock is enabled and on admin view */}
        {user?.role === 'admin' && config.enabled && view === 'admin' && !isLocked && (
          <button
            onClick={lock}
            title="Lock admin panel"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
        )}

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