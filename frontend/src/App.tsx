import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }          from './context/ToastContext';
import { SettingsProvider }        from './context/SettingsContext';
import { AdminLockProvider, useAdminLock } from './context/AdminLockContext';
import LoginScreen   from './components/LoginScreen';
import TopBar        from './components/TopBar';
import WaiterView    from './views/WaiterView';
import KitchenView   from './views/KitchenView';
import AdminView     from './views/AdminView';
import ReportsView   from './views/ReportsView';
import BugReportView from './views/BugReportView';
import type { ViewType, UserRole } from './types';
import './index.css';

const DEFAULT_VIEW: Record<UserRole, ViewType> = {
  admin:   'waiter',
  waiter:  'waiter',
  kitchen: 'kitchen',
};

function Shell() {
  const { user } = useAuth();
  const { config, isLocked, lock, unlock, requestPin } = useAdminLock();
  const [view, setView] = useState<ViewType>('waiter');
  const lastAdminVisit = useRef<number>(0);

  useEffect(() => {
    if (user) setView(DEFAULT_VIEW[user.role]);
  }, [user]);

  if (!user) return <LoginScreen />;

  const handleSetView = async (v: ViewType) => {
    if (v === 'admin' && config.enabled && user.role === 'admin') {
      const now     = Date.now();
      const elapsed = (now - lastAdminVisit.current) / 60000;
      const needPin = isLocked || (config.timeout_mins === 0 ? lastAdminVisit.current > 0 : elapsed > config.timeout_mins);

      if (needPin && lastAdminVisit.current > 0) {
        const ok = await requestPin();
        if (!ok) return;
      }
      lastAdminVisit.current = now;
      unlock();
    }
    setView(v);
  };

  const handleViewChange = async (v: ViewType) => {
    if (view === 'admin' && v !== 'admin') {
      lastAdminVisit.current = Date.now();
    }
    await handleSetView(v);
  };

  const content: Record<ViewType, React.ReactNode> = {
    waiter:    <WaiterView />,
    kitchen:   <KitchenView />,
    admin:     <AdminView />,
    reports:   <ReportsView />,
    bugreport: <BugReportView currentView={view} />,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      <TopBar view={view} setView={handleViewChange} />
      <main className="flex-1 overflow-hidden">
        {content[view]}
      </main>
    </div>
  );
}

// Called by AdminLockProvider to verify the admin PIN.
// Uses /staff/check-pin — does NOT create or touch login sessions.
const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

async function verifyPinFn(pin: string): Promise<boolean> {
  try {
    const tokenRes = await fetch(`${API_BASE}/api/auth/token`);
    const tokenData = await tokenRes.json();
    const token = tokenData.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/staff/check-pin`, {
      method: 'POST', headers, body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <AdminLockProvider verifyPin={verifyPinFn}>
            <Shell />
          </AdminLockProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}