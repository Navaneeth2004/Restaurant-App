/**
 * views/admin/LocalBackupSection.tsx
 *
 * Local auto-backup configuration panel.
 * Extracted from AdminBackup.tsx.
 *
 * FIX: "Back Up Now" used to toast the full file path
 * (e.g. "Saved to /home/user/pos-backups/pos_backup_2026-06-20...zip"),
 * which is long and not useful to read in a toast. Now just confirms
 * success; the path is still visible afterwards via "Last saved" below.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useToast }    from '../../context/ToastContext';
import { authedJson }  from '../../utils/authedFetch';

const API = process.env.REACT_APP_API_URL || window.location.origin;

const SCHEDULES = [
  { key: 'off',   label: 'Off'         },
  { key: '1h',    label: 'Every hour'  },
  { key: '2h',    label: 'Every 2h'   },
  { key: '6h',    label: 'Every 6h'   },
  { key: '12h',   label: 'Every 12h'  },
  { key: 'daily', label: 'Daily'      },
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block flex-shrink-0" />
  );
}

interface LocalStatus {
  folder:        string | null;
  schedule:      string;
  last_backup:   string | null;
  last_filename: string | null;
}

export default function LocalBackupSection() {
  const toast = useToast();
  const [localStatus,        setLocalStatus]        = useState<LocalStatus | null>(null);
  const [selectedLocalSched, setSelectedLocalSched] = useState('off');
  const [localFolder,        setLocalFolder]        = useState('');
  const [saveLocalSched,     setSaveLocalSched]     = useState(false);
  const [localBacking,       setLocalBacking]       = useState(false);

  const loadLocalStatus = useCallback(async () => {
    try {
      const d = await authedJson(`${API}/api/backup/local/status`);
      setLocalStatus(d);
      setSelectedLocalSched(d.schedule || 'off');
      if (d.folder) setLocalFolder(d.folder);
    } catch {}
  }, []);

  useEffect(() => { loadLocalStatus(); }, [loadLocalStatus]);

  const handleSaveLocalSchedule = async () => {
    setSaveLocalSched(true);
    try {
      await authedJson(`${API}/api/backup/local/config`, {
        method: 'PUT',
        body: JSON.stringify({ folder: localFolder.trim() || null, schedule: selectedLocalSched }),
      });
      const label = SCHEDULES.find(s => s.key === selectedLocalSched)?.label;
      toast(
        selectedLocalSched === 'off'
          ? 'Local auto-backup disabled.'
          : `Local auto-backup: ${label}`,
        'success'
      );
      loadLocalStatus();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSaveLocalSched(false);
    }
  };

  const handleLocalBackupNow = async () => {
    setLocalBacking(true);
    try {
      await authedJson(`${API}/api/backup/local/now`, {
        method: 'POST',
        body: JSON.stringify({ folder: localFolder.trim() || null }),
      });
      // FIX: short, simple confirmation instead of toasting the full path.
      toast('Saved successfully', 'success');
      loadLocalStatus();
    } catch (e: any) {
      toast(e.message || 'Local backup failed', 'error');
    } finally {
      setLocalBacking(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-white text-sm font-semibold">Local Auto-Backup</p>
          {localStatus?.schedule && localStatus.schedule !== 'off' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-400">
              {SCHEDULES.find(s => s.key === localStatus.schedule)?.label}
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Automatically save backups to a folder on this computer. Keeps the last 7 backups.
        </p>
        {localStatus?.last_backup && (
          <p className="text-zinc-600 text-xs mt-1">
            Last saved: <span className="text-zinc-400">{timeAgo(localStatus.last_backup)}</span>
            {localStatus.last_filename && (
              <span className="text-zinc-600"> — {localStatus.last_filename}</span>
            )}
          </p>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="label">Backup Folder Path</label>
          <input
            className="input text-xs font-mono"
            placeholder="e.g. C:\Backups\POS  or  /home/user/pos-backups"
            value={localFolder}
            onChange={e => setLocalFolder(e.target.value)}
          />
          <p className="text-zinc-600 text-[10px] mt-1">
            Leave blank to use backend/data/backups/ (inside the app folder)
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white text-xs font-semibold">Auto-backup Schedule</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {SCHEDULES.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedLocalSched(s.key)}
                className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                  selectedLocalSched === s.key
                    ? 'bg-brand-500 border-brand-600 text-white'
                    : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              className="btn btn-brand btn-sm flex items-center gap-2"
              onClick={handleSaveLocalSchedule}
              disabled={saveLocalSched}
            >
              {saveLocalSched ? <><Spinner />Saving…</> : 'Save Schedule'}
            </button>
            <button
              className="btn btn-sm flex items-center gap-2"
              onClick={handleLocalBackupNow}
              disabled={localBacking}
            >
              {localBacking ? (
                <><Spinner />Backing up…</>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Back Up Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}