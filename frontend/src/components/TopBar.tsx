import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAdminLock } from '../context/AdminLockContext';
import ConfirmModal from './ConfirmModal';
import type { ViewType, UserRole } from '../types';

interface NavItem { key: ViewType; label: string; roles: UserRole[]; }
const NAV: NavItem[] = [
  { key: 'waiter',    label: 'Waiter',  roles: ['admin','waiter'] },
  { key: 'kitchen',   label: 'Kitchen', roles: ['admin','kitchen'] },
  { key: 'admin',     label: 'Admin',   roles: ['admin'] },
  { key: 'reports',   label: 'Reports', roles: ['admin'] },
  { key: 'export',    label: 'Export',  roles: ['admin'] },
  { key: 'backup',    label: 'Backup',  roles: ['admin'] },
  { key: 'bugreport', label: 'Ticket',  roles: ['admin','waiter','kitchen'] },
];

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props { view: ViewType; setView: (v: ViewType) => void; }

export default function TopBar({ view, setView }: Props) {
  const { user, logout }   = useAuth();
  const settings           = useSettings();
  const { config, isLocked, lock } = useAdminLock();
  const allowed  = NAV.filter(n => user?.role && n.roles.includes(user.role));
  const logoUrl  = (settings as any).logo_url as string | undefined;

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  const adminProtectedViews: ViewType[] = ['admin', 'export', 'backup'];

  return (
    <>
      {showLogoutConfirm && (
        <ConfirmModal
          title="Log Out"
          message={`Log out of "${user?.name}"? You will need to enter your PIN to log back in.`}
          confirmLabel="Log Out"
          cancelLabel="Stay Logged In"
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      <header className="h-14 flex-shrink-0 flex items-center px-4 gap-2 border-b border-surface-border bg-surface-card">
        {/* Logo + Name */}
        <div className="flex items-center gap-2.5 mr-3 flex-shrink-0">
          {logoUrl && (
            <img src={`${API_BASE}${logoUrl}`} alt="logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          )}
          <span className="font-display font-bold text-white text-sm tracking-tight hidden sm:block truncate max-w-[140px]">
            {settings.restaurant_name || 'POS'}
          </span>
        </div>

        <div className="w-px h-5 bg-surface-border mx-1 hidden sm:block flex-shrink-0" />

        {/* Nav */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {allowed.map(n => {
            const isAdminLocked = adminProtectedViews.includes(n.key) && config.enabled && isLocked;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  view === n.key
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-surface-raised border border-transparent'
                }`}
              >
                {n.label}
                {isAdminLocked && (
                  <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* Lock button — shown when on any admin-protected view */}
          {user?.role === 'admin' && config.enabled && adminProtectedViews.includes(view) && !isLocked && (
            <button
              onClick={() => { lock(); setView('waiter'); }}
              title="Lock admin panel"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/8 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="hidden sm:inline">Lock</span>
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
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs text-zinc-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-raised transition-colors border border-transparent hover:border-surface-border"
          >
            Log out
          </button>
        </div>
      </header>
    </>
  );
}