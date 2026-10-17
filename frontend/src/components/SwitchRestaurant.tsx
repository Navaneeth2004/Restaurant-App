/**
 * components/SwitchRestaurant.tsx
 *
 * Shown on the PIN screen. Lets someone disconnect THIS device from the current restaurant (wrong restaurant
 * linked, device handed to someone else, …) and go back to the connect screen (owner login / staff code).
 * It needs an ADMIN PIN so nobody can unlink a shared tablet by accident or on purpose.
 */
import React, { useState } from 'react';
import { PinModal } from './admin/PinModal';

const API = process.env.REACT_APP_API_URL || window.location.origin;
const post = (path: string, body: object) => fetch(`${API}${path}`, {
  method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export default function SwitchRestaurant() {
  const [open, setOpen] = useState(false);

  const verify = async (pin: string): Promise<boolean> => {
    try { const r = await post('/api/staff/check-pin', { pin }); const d = await r.json(); return d.valid === true; }
    catch { return false; }
  };
  const unlink = async (pin: string) => {
    setOpen(false);
    try { await post('/api/auth/device/unlink', { pin }); } catch (_) {}
    sessionStorage.clear();
    window.dispatchEvent(new Event('pos-device-lost'));      // DeviceGate shows the connect screen again
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="block mx-auto mt-3 text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
        Not your restaurant? Switch restaurant
      </button>
      {open && (
        <PinModal
          title="Admin PIN required"
          subtitle="Enter the admin PIN to disconnect this device from this restaurant"
          verifyFn={verify}
          onSuccess={unlink}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}