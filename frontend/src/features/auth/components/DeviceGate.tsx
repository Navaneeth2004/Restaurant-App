import { ReactNode } from 'react';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useDevice } from 'state/device/useDevice';
import ConnectScreens from './ConnectScreens';

/** Barrier 1: nothing in the app shows until this browser is linked to a restaurant. */
export default function DeviceGate({ children }: { children: ReactNode }) {
  const { status, offline, suspendedMessage, refresh } = useDevice();

  if (status === null) {
    if (!offline) return <PageSpinner />;
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 text-sm">Cannot reach the server.</p>
        <button type="button" className="btn btn-brand" onClick={refresh}>Try again</button>
      </div>
    );
  }
  if (status.linked) return <>{children}</>;

  const notice = status.suspended ? (suspendedMessage ?? 'This restaurant account is not active. Please contact support.') : null;
  return <ConnectScreens registrationOpen={status.registration_open !== false} notice={notice} onLinked={refresh} />;
}
