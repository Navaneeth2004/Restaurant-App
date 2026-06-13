/**
 * AdminLockSettings.tsx
 * Settings panel shown inside Admin > Restaurant to configure the admin lock.
 */
import React, { useState } from 'react';
import { useAdminLock } from '../../context/AdminLockContext';

const TIMEOUTS = [
  { key: 0,   label: 'Always ask' },
  { key: 2,   label: '2 minutes' },
  { key: 5,   label: '5 minutes' },
  { key: 10,  label: '10 minutes' },
  { key: 30,  label: '30 minutes' },
];

/** Shared toggle pill used across the admin UI — fixed alignment */
export function TogglePill({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card
        ${enabled ? 'bg-brand-500 border-brand-600' : 'bg-zinc-700 border-zinc-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
          ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export default function AdminLockSettings() {
  const { config, setConfig } = useAdminLock();
  const [saved, setSaved] = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const toggle = () => { setConfig({ ...config, enabled: !config.enabled }); flash(); };
  const setTimeoutMins = (t: number) => { setConfig({ ...config, timeout_mins: t }); flash(); };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-sm mb-0.5">Admin Panel Lock</h3>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Require a PIN to access the Admin tab and to perform sensitive actions like downloading reports, exporting menus, connecting Google Drive, and resetting the app.
          </p>
        </div>
        {saved && (
          <span className="text-emerald-400 text-xs flex items-center gap-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer mb-4 select-none">
        <TogglePill enabled={config.enabled} onChange={toggle} />
        <div>
          <span className="text-sm font-medium text-white">
            {config.enabled ? 'Lock enabled' : 'Lock disabled'}
          </span>
          <p className="text-zinc-600 text-xs">
            {config.enabled
              ? 'Workers cannot access admin without a PIN'
              : 'All staff can access the Admin tab freely'}
          </p>
        </div>
      </label>

      {/* Timeout setting */}
      {config.enabled && (
        <div className="border-t border-surface-border pt-4">
          <label className="label mb-2">Session timeout</label>
          <p className="text-zinc-600 text-xs mb-3 leading-relaxed">
            How long after unlocking before the PIN is required again. "Always ask" means every time you navigate away from Admin.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TIMEOUTS.map(t => (
              <button
                key={t.key}
                onClick={() => setTimeoutMins(t.key)}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  config.timeout_mins === t.key
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}