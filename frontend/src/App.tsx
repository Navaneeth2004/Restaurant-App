import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }          from './context/ToastContext';
import { SettingsProvider }        from './context/SettingsContext';
import LoginScreen  from './components/LoginScreen';
import TopBar       from './components/TopBar';
import WaiterView   from './views/WaiterView';
import KitchenView  from './views/KitchenView';
import AdminView    from './views/AdminView';
import ReportsView  from './views/ReportsView';
import type { ViewType, UserRole } from './types';
import './index.css';

const DEFAULT_VIEW: Record<UserRole, ViewType> = {
  admin:   'waiter',
  waiter:  'waiter',
  kitchen: 'kitchen',
};

function Shell() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewType>('waiter');

  useEffect(() => {
    if (user) setView(DEFAULT_VIEW[user.role]);
  }, [user]);

  if (!user) return <LoginScreen />;

  const content: Record<ViewType, React.ReactNode> = {
    waiter:  <WaiterView />,
    kitchen: <KitchenView />,
    admin:   <AdminView />,
    reports: <ReportsView />,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      <TopBar view={view} setView={setView} />
      <main className="flex-1 overflow-hidden">
        {content[view]}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
