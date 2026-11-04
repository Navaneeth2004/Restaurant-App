import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import ErrorBoundary from './ErrorBoundary';
import ToastProvider from 'state/toast/ToastProvider';
import Providers from './Providers';
import Shell from './Shell';

const KioskPage = lazy(() => import('features/kiosk/components/KioskPage'));
const RootApp = lazy(() => import('features/root/components/RootApp'));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* The platform operator's console: its own login, outside the device/staff providers. */}
          <Route path="/root/*" element={<Suspense fallback={<PageSpinner />}><RootApp /></Suspense>} />
          {/* Customer QR page: public, so it sits outside the device/staff providers (only toasts are needed). */}
          <Route path="/kiosk/:token" element={<ToastProvider><Suspense fallback={<PageSpinner />}><KioskPage /></Suspense></ToastProvider>} />
          {/* /pair is handled by the device gate (it reads the path and ?code=). */}
          <Route path="*" element={<Providers><Shell /></Providers>} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
