import React, { useState, useEffect, useCallback } from 'react';
import { getStaff, createStaff, deleteStaff } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import type { Staff } from '../../types';

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-red-500/15 text-red-400 border-red-500/25',
  kitchen: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  waiter:  'bg-brand-500/15 text-brand-400 border-brand-500/25',
};

function StaffModal({ onSave, onClose }: { onSave: (f:{name:string;pin:string;role:string}) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [pin,  setPin]  = useState('');
  const [role, setRole] = useState('waiter');
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white text-base mb-4">Add Staff Member</h3>
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" placeholder="e.g. Ali" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div><label className="label">PIN (4 digits min)</label><input className="input font-mono tracking-widest" type="password" maxLength={6} placeholder="••••" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} /></div>
          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {['waiter','kitchen','admin'].map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${role===r ? `${ROLE_STYLES[r]} border` : 'border-surface-border text-zinc-500 hover:text-white'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-surface-raised border border-surface-border p-3 text-xs text-zinc-500 space-y-1">
            <div><span className="text-brand-400">Waiter</span> — takes orders, generates bills</div>
            <div><span className="text-blue-400">Kitchen</span> — sees and manages kitchen display</div>
            <div><span className="text-red-400">Admin</span> — full access to all screens</div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={() => name && pin.length>=4 && onSave({name,pin,role})} disabled={!name||pin.length<4}>Add</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [modal, setModal] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => { try { setStaff(await getStaff()); } catch {} }, []);
  useEffect(() => { load(); }, []);

  const handleAdd = async (f: {name:string;pin:string;role:string}) => {
    try { await createStaff(f); toast('Staff added','success'); setModal(false); load(); }
    catch (e: any) { toast(e.response?.data?.error||'Failed','error'); }
  };

  const handleDelete = async (id: number) => {
    if (id === user?.id) { toast("Can't delete yourself",'error'); return; }
    if (!window.confirm('Remove this staff member?')) return;
    try { await deleteStaff(id); toast('Removed','success'); load(); }
    catch { toast('Failed','error'); }
  };

  // FIX #13: 2-col layout
  const byRole = { admin: staff.filter(s=>s.role==='admin'), kitchen: staff.filter(s=>s.role==='kitchen'), waiter: staff.filter(s=>s.role==='waiter') };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-bold text-white text-sm">Staff</h3>
        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{staff.length} members</span>
        <button className="btn btn-brand btn-sm ml-auto" onClick={() => setModal(true)}>+ Add Staff</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['admin','kitchen','waiter'] as const).map(role => (
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => handleDelete(s.id)} disabled={s.id === user?.id}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              ))}
              {byRole[role].length === 0 && <p className="text-zinc-700 text-xs text-center py-3">None</p>}
            </div>
          </div>
        ))}
      </div>

      {modal && <StaffModal onSave={handleAdd} onClose={() => setModal(false)} />}
    </div>
  );
}
