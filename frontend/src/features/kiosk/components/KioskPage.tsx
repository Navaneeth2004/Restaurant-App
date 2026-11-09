import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { isApiError, errorMessage } from 'api/errors';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { setKioskToken } from 'realtime/socket';
import { applyBrand } from 'state/settings/applyBrand';
import { useKioskBoot } from '../hooks/useKioskBoot';
import KioskApp from './KioskApp';
import MessageScreen from './screens/MessageScreen';

/** /kiosk/:token — the page a customer's phone opens after scanning a table QR. No login, no staff providers. */
export default function KioskPage() {
  const { token = '' } = useParams();
  // Must be set before any child subscribes to the socket (children's effects run before this component's).
  useMemo(() => setKioskToken(token), [token]);
  const boot = useKioskBoot(token);
  const brand = boot.data?.ctx.brand_color;
  useEffect(() => { if (brand) applyBrand(brand); }, [brand]);

  if (boot.loading && !boot.data) return <PageSpinner />;
  if (boot.data) return <KioskApp token={token} boot={boot.data} />;
  const invalid = isApiError(boot.error) && boot.error.status === 404;
  const switchedOff = isApiError(boot.error) && boot.error.code === 'feature_disabled';
  const title = invalid ? 'Invalid QR code' : switchedOff ? 'Ordering from your phone is not available' : 'Could not load the menu';
  return (
    <div className="h-[100dvh] max-w-[480px] mx-auto flex flex-col bg-surface">
      <MessageScreen icon="qr" title={title} action={invalid || switchedOff ? undefined : { label: 'Try again', onClick: boot.reload }}>
        {invalid ? 'This QR code is not valid or has expired. Please ask your waiter for a new one.'
          : switchedOff ? 'Please ask your waiter to take your order.' : errorMessage(boot.error, 'Please scan the QR code again.')}
      </MessageScreen>
    </div>
  );
}
