import { ComponentType, LazyExoticComponent, lazy } from 'react';
import type { Role } from 'config/constants';
import { FeatureKey, SCREEN_FEATURES } from 'state/features/feature-keys';

export interface ViewDef {
  key: string;
  label: string;
  roles: ReadonlyArray<Role>;
  /** Requires the admin PIN when the admin lock is enabled. */
  adminLocked?: boolean;
  /** The screen is shown while ANY of these features is on (root can switch them off). */
  features: ReadonlyArray<FeatureKey>;
  Component: ComponentType | LazyExoticComponent<ComponentType>;
}

const Waiter = lazy(() => import('features/waiter/components/WaiterView'));
const Admin = lazy(() => import('features/admin/components/AdminView'));
const Kitchen = lazy(() => import('features/kitchen/components/KitchenView'));
const Reports = lazy(() => import('features/reports/components/ReportsView'));
const Export = lazy(() => import('features/export/components/ExportView'));
const Backup = lazy(() => import('features/backup/components/BackupView'));
const Support = lazy(() => import('features/support/components/BugReportView'));

/** Adding a screen = one feature folder + one line here (+ its key in state/features/feature-keys.ts and the backend registry). */
export const VIEWS: ReadonlyArray<ViewDef> = [
  { key: 'waiter', label: 'Waiter', roles: ['admin', 'waiter'], features: SCREEN_FEATURES.waiter, Component: Waiter },
  { key: 'kitchen', label: 'Kitchen', roles: ['admin', 'kitchen'], features: SCREEN_FEATURES.kitchen, Component: Kitchen },
  { key: 'admin', label: 'Admin', roles: ['admin'], adminLocked: true, features: SCREEN_FEATURES.admin, Component: Admin },
  { key: 'reports', label: 'Reports', roles: ['admin'], features: SCREEN_FEATURES.reports, Component: Reports },
  { key: 'export', label: 'Export', roles: ['admin'], adminLocked: true, features: SCREEN_FEATURES.export, Component: Export },
  { key: 'backup', label: 'Backup', roles: ['admin'], adminLocked: true, features: SCREEN_FEATURES.backup, Component: Backup },
  { key: 'bugreport', label: 'Ticket', roles: ['admin', 'waiter', 'kitchen'], features: SCREEN_FEATURES.support, Component: Support },
];

export const viewsForRole = (role: Role): ViewDef[] => VIEWS.filter(v => v.roles.includes(role));
