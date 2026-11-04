import { useEffect } from 'react';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import ToastProvider from 'state/toast/ToastProvider';
import { useRootSession } from '../hooks/useRootSession';
import RootLogin from './RootLogin';
import RootShell from './RootShell';

/** The platform operator's console, opened at /root. Root accounts are created on the server only (scripts/admin.js create-root). */
export default function RootApp() {
  const { phone, login, logout } = useRootSession();
  useEffect(() => { document.title = 'Root console'; }, []);
  return (
    <ToastProvider>
      {phone === undefined ? <PageSpinner /> : phone === null ? <RootLogin onLogin={login} /> : <RootShell phone={phone} onLogout={() => void logout()} />}
    </ToastProvider>
  );
}
