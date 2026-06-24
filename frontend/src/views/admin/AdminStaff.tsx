import React, { useState, useEffect, useCallback } from 'react';
import { getStaff, createStaff, deleteStaff } from '../../services/api';
import { useToast }      from '../../context/ToastContext';
import { useAuth }       from '../../context/AuthContext';
import { useAdminLock }  from '../../context/AdminLockContext';
import { authedFetch }   from '../../utils/authedFetch';
import ConfirmModal      from '../../components/ConfirmModal';
import ChangePinModal    from '../../components/admin/ChangePinModal';
import StaffModal        from '../../components/admin/StaffModal';
import type { Staff } from '../../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-red-500/15 text-red-400 border-red-500/25',
  kitchen: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  waiter:  'bg-brand-500/15 text-brand-400 border-brand-500/25',
};

export default function AdminStaff() {
  const [staff,        setStaff]        = useState<Staff[]>([]);
  const [modal,        setModal]        = useState(false);
  const [changePinFor, setChangePinFor] = useState<Staff | null>(null);
  const [confirm,      setConfirm]      = useState<{ staff: Staff } | null>(null);
  const toast = useToast();
  const { user } = useAuth();
  const { requirePin, config: lockConfig } = useAdminLock();

  const load = useCallback(async () => {
    try { setStaff(await getStaff()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returns a promise so StaffModal can catch the 409 and show inline error
  const handleAdd = async (f: { name: string; pin: string; role: string }) => {
    const res = await authedFetch(`${API_BASE}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error || 'Failed to add staff';
      toast(msg, 'error');
      throw new Error(msg);   // bubble up so StaffModal shows inline error
    }
    toast('Staff added', 'success');
    setModal(false);
    load();
  };

  const handleDelete = (s: Staff) => {
    if (s.id === user?.id) { toast("You can't delete your own account", 'error'); return; }
    if (!lockConfig.enabled) { setConfirm({ staff: s }); return; }
    requirePin(() => setConfirm({ staff: s }), 'Remove Staff Member', 'Enter admin PIN to remove staff');
  };

  const doDelete = async (id: number) => {
    setConfirm(null);
    try {
      await deleteStaff(id);
      toast('Removed', 'success');
      load();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to remove staff', 'error');
    }
  };

  // Returns a promise so ChangePinModal can catch the 409 and show inline error
  const handleChangePin = async (newPin: string) => {
    if (!changePinFor) return;
    const res = await authedFetch(`${API_BASE}/api/staff/${changePinFor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any).error || 'Failed to update PIN';
      toast(msg, 'error');
      throw new Error(msg);   // bubble up so ChangePinModal shows inline error
    }
    toast(`PIN updated for ${changePinFor.name}`, 'success');
    setChangePinFor(null);
  };

  const adminCount = staff.filter(s => s.role === 'admin' && s.active).length;

  const byRole = {
    admin:   staff.filter(s => s.role === 'admin'),
    kitchen: staff.filter(s => s.role === 'kitchen'),
    waiter:  staff.filter(s => s.role === 'waiter'),
  };

  const canDelete = (s: Staff) => {
    if (s.id === user?.id) return false;
    if (s.role === 'admin' && adminCount <= 1) return false;
    return true;
  };

  const deleteTooltip = (s: Staff) => {
    if (s.id === user?.id) return "Can't delete your own account";
    if (s.role === 'admin' && adminCount <= 1) return 'Cannot delete the last admin';
    return 'Remove staff member';
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-bold text-white text-sm">Staff</h3>
        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
          {staff.length} members
        </span>
        <button className="btn btn-brand btn-sm ml-auto" onClick={() => setModal(true)}>+ Add Staff</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['admin', 'kitchen', 'waiter'] as const).map(role => (
          <div key={role} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
              <span className={`text-xs font-bold capitalize px-2.5 py-0.5 rounded-full border ${ROLE_STYLES[role]}`}>{role}</span>
              <span className="text-zinc-600 text-xs ml-auto">{byRole[role].length}</span>
            </div>
            <div className="p-3 space-y-2">
              {byRole[role].map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-raised">
                  <div className="w-8 h-8 rounded-full bg-brand-500/15 border border-brand-500/20 flex items-center justify-center font-bold text-brand-400 text-sm flex-shrink-0">
                    {s.name[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-white text-sm font-medium">{s.name}</span>
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                    onClick={() => setChangePinFor(s)}
                    title="Change PIN"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </button>
                  <button
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      canDelete(s)
                        ? 'text-red-500/40 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-zinc-700 cursor-not-allowed'
                    }`}
                    onClick={() => canDelete(s) && handleDelete(s)}
                    title={deleteTooltip(s)}
                    disabled={!canDelete(s)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
              {byRole[role].length === 0 && (
                <p className="text-zinc-700 text-xs text-center py-3">None</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <details className="group">
          <summary className="text-zinc-600 text-xs cursor-pointer hover:text-zinc-400 transition-colors select-none list-none flex items-center gap-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Forgot your admin PIN?
          </summary>
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Run this command on the server to reset the admin PIN to <span className="font-mono text-zinc-300">0000</span>:
                </p>
                <code className="block mt-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-green-400 text-[11px] font-mono select-all">
                  cd backend && node -e "const db=require('./db/database'); db.prepare(\"UPDATE staff SET pin='0000' WHERE role='admin'\").run(); console.log('Done');"
                </code>
                <p className="text-zinc-600 text-[10px] mt-1.5">Then log in with PIN 0000 and change it from this page.</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      {confirm && (
        <ConfirmModal
          title="Remove Staff Member"
          message={`Remove ${confirm.staff.name} from staff? This cannot be undone.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => doDelete(confirm.staff.id)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {modal && <StaffModal onSave={handleAdd} onClose={() => setModal(false)} />}

      {changePinFor && (
        <ChangePinModal
          staff={changePinFor}
          onSave={handleChangePin}
          onClose={() => setChangePinFor(null)}
        />
      )}
    </div>
  );
}