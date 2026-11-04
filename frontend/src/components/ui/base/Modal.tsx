import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  /** Escape key and the backdrop call this. Omit to make the dialog non-dismissible except via its own buttons. */
  onClose?: () => void;
  /** Backdrop clicks never close by default: half-typed forms must not be lost. */
  closeOnBackdrop?: boolean;
  className?: string;
  /** false = no inner padding (for sheets that draw their own edges, like the bill). */
  padded?: boolean;
  z?: number;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, children, onClose, closeOnBackdrop = false, className = 'max-w-sm', padded = true, z = 50 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = box.current;
    const items = (): HTMLElement[] => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    if (node && !node.contains(document.activeElement)) (items()[0] ?? node).focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const f = items();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
      style={{ zIndex: z }}
      onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`rounded-xl border border-surface-border bg-surface-card ${padded ? 'p-5' : ''} w-full ${className} animate-slide-up shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
