import { ComponentType, LazyExoticComponent, lazy } from 'react';
import type { Role } from 'config/constants';

export interface ViewDef {
  key: string;
  label: string;
  roles: ReadonlyArray<Role>;
  /** Requires the admin PIN when the admin lock is enabled. */
  adminLocked?: boolean;
  Component: ComponentType | LazyExoticComponent<ComponentType>;
}

const Waiter = lazy(() => import('features/waiter/components/WaiterView'));
const Admin = lazy(() => import('features/admin/components/AdminView'));
const Kitchen = lazy(() => import('features/kitchen/components/KitchenView'));
const Reports = lazy(() => import('features/reports/components/ReportsView'));
const Export = lazy(() => import('features/export/components/ExportView'));
const Backup = lazy(() => import('features/backup/components/BackupView'));
const Support = lazy(() => import('features/support/components/BugReportView'));

/** Adding a screen = one feature folder + one line here. */
export const VIEWS: ReadonlyArray<ViewDef> = [
  { key: 'waiter', label: 'Waiter', roles: ['admin', 'waiter'], Component: Waiter },
  { key: 'kitchen', label: 'Kitchen', roles: ['admin', 'kitchen'], Component: Kitchen },
  { key: 'admin', label: 'Admin', roles: ['admin'], adminLocked: true, Component: Admin },
  { key: 'reports', label: 'Reports', roles: ['admin'], Component: Reports },
  { key: 'export', label: 'Export', roles: ['admin'], adminLocked: true, Component: Export },
  { key: 'backup', label: 'Backup', roles: ['admin'], adminLocked: true, Component: Backup },
  { key: 'bugreport', label: 'Ticket', roles: ['admin', 'waiter', 'kitchen'], Component: Support },
];

export const viewsForRole = (role: Role): ViewDef[] => VIEWS.filter(v => v.roles.includes(role));
