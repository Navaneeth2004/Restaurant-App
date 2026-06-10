import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-500/15 border border-red-500/25' : 'bg-brand-500/15 border border-brand-500/25'}`}>
            {danger ? (
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm leading-tight">{title}</h3>
            <p className="text-zinc-400 text-xs leading-relaxed mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn flex-1 text-sm" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn flex-1 text-sm ${danger ? 'btn-danger' : 'btn-brand'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}