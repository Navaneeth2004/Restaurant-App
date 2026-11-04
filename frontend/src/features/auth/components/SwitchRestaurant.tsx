import { useState } from 'react';
import { unlinkDevice } from 'api/access/auth.api';
import { checkPin } from 'api/access/staff.api';
import PinModal from 'components/pin/PinModal';
import { WINDOW_EVENTS } from 'config/events';
import { STORAGE } from 'config/storage-keys';
import { closeSocket } from 'realtime/socket';
import { useToast } from 'state/toast/useToast';
import { errorMessage } from 'api/errors';

/** Disconnects THIS device from the restaurant; needs an admin PIN. */
export default function SwitchRestaurant() {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const unlink = async (pin: string): Promise<void> => {
    setOpen(false);
    try {
      await unlinkDevice(pin);
      closeSocket();
      sessionStorage.removeItem(STORAGE.settingsCache);
      window.dispatchEvent(new Event(WINDOW_EVENTS.deviceLost));
    } catch (e) { toast(errorMessage(e, 'Could not disconnect this device'), 'error'); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block mx-auto mt-3 text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
        Not your restaurant? Switch restaurant
      </button>
      {open && (
        <PinModal title="Admin PIN required" subtitle="Enter the admin PIN to disconnect this device from this restaurant"
          verify={checkPin} onSuccess={pin => { void unlink(pin); }} onCancel={() => setOpen(false)} />
      )}
    </>
  );
}
