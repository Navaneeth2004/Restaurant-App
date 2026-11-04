import ViewHeader from 'components/layout/ViewHeader';
import { APP_VERSION } from 'config/constants';
import { useSecretTap } from '../hooks/useSecretTap';
import DangerZone from './DangerZone';
import DownloadCard from './DownloadCard';
import RestoreCard from './RestoreCard';

export default function BackupView() {
  const secret = useSecretTap(5, 2000);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader title="Backup" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="space-y-4 max-w-2xl">
          <div><h3 className="font-bold text-white text-sm mb-1">Backup &amp; Restore</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">Protects your menu, orders, staff and settings. Back up regularly and keep the file somewhere safe.</p></div>
          <DownloadCard />
          <RestoreCard />
          <div className="text-center pt-2"><button type="button" tabIndex={-1} className="text-zinc-800 text-[10px] select-none cursor-default" onClick={secret.tap}>v{APP_VERSION}</button></div>
          {secret.revealed && <DangerZone onHide={secret.hide} />}
        </div>
      </div>
    </div>
  );
}
