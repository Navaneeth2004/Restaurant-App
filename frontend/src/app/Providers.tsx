import { ReactNode } from 'react';
import DeviceGate from 'features/auth/components/DeviceGate';
import AdminLockProvider from 'state/admin-lock/AdminLockProvider';
import AuthProvider from 'state/auth/AuthProvider';
import DeviceProvider from 'state/device/DeviceProvider';
import SettingsProvider from 'state/settings/SettingsProvider';
import ToastProvider from 'state/toast/ToastProvider';
import FailureToasts from './FailureToasts';

/** Composition order = dependency order: toast → device → (gate) → settings → auth → admin lock. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FailureToasts />
      <DeviceProvider>
        <DeviceGate>
          <SettingsProvider>
            <AuthProvider>
              <AdminLockProvider>{children}</AdminLockProvider>
            </AuthProvider>
          </SettingsProvider>
        </DeviceGate>
      </DeviceProvider>
    </ToastProvider>
  );
}
