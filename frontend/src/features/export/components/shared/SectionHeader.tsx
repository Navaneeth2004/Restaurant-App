import { ReactNode } from 'react';

const TONES = { blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20', green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };

export default function SectionHeader({ title, badge, tone, children }: { title: string; badge: string; tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${TONES[tone]}`}>{badge}</span>
      </div>
      <p className="text-zinc-500 text-xs leading-relaxed">{children}</p>
    </div>
  );
}
