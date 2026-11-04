import { ReactNode } from 'react';

interface Props { label: string; htmlFor: string; hint?: string; children: ReactNode }

export default function Field({ label, htmlFor, hint, children }: Props) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-zinc-700 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}
