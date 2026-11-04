import SectionCard from 'components/ui/base/SectionCard';
import Toggle from 'components/ui/base/Toggle';
import { LOCK_TIMEOUTS } from 'config/constants';
import { useAdminLock } from 'state/admin-lock/useAdminLock';

export default function LockSettings() {
  const { config, setConfig } = useAdminLock();
  return (
    <SectionCard title="Admin Panel Lock" desc="Require a PIN to open the Admin, Export and Backup tabs and to do sensitive things like downloading reports, exporting menus and resetting the app.">
      <div className="flex items-center gap-3 mb-4">
        <Toggle enabled={config.enabled} label="Admin lock" onChange={() => { void setConfig({ ...config, enabled: !config.enabled }); }} />
        <div>
          <span className="text-sm font-medium text-white">{config.enabled ? 'Lock enabled' : 'Lock disabled'}</span>
          <p className="text-zinc-600 text-xs">{config.enabled ? 'Workers cannot access admin without a PIN' : 'All staff can access the Admin tab freely'}</p>
        </div>
      </div>
      {config.enabled && (
        <div className="border-t border-surface-border pt-4">
          <span className="label">Session timeout</span>
          <p className="text-zinc-600 text-xs mb-3 leading-relaxed">How long after unlocking before the PIN is required again. "Always ask" means every time you leave Admin.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {LOCK_TIMEOUTS.map(t => (
              <button key={t.mins} type="button" aria-pressed={config.timeout_mins === t.mins} onClick={() => { void setConfig({ ...config, timeout_mins: t.mins }); }}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${config.timeout_mins === t.mins ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>{t.label}</button>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
