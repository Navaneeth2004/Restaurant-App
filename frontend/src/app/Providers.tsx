import { ReactNode } from 'react';
import DeviceGate from 'features/auth/components/DeviceGate';
import AdminLockProvider from 'state/admin-lock/AdminLockProvider';
import AuthProvider from 'state/auth/AuthProvider';
import DeviceProvider from 'state/device/DeviceProvider';
import FeaturesProvider from 'state/features/FeaturesProvider';
import SettingsProvider from 'state/settings/SettingsProvider';
import ToastProvider from 'state/toast/ToastProvider';
import FailureToasts from './FailureToasts';

/** Composition order = dependency order: toast → device → (gate) → settings → features → auth → admin lock. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FailureToasts />
      <DeviceProvider>
        <DeviceGate>
          <SettingsProvider>
            <FeaturesProvider>
              <AuthProvider>
                <AdminLockProvider>{children}</AdminLockProvider>
              </AuthProvider>
            </FeaturesProvider>
          </SettingsProvider>
        </DeviceGate>
      </DeviceProvider>
    </ToastProvider>
  );
}
