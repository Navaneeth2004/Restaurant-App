import { ReactNode } from 'react';
import Icon, { IconName } from 'components/ui/base/Icon';

interface Props { icon: IconName; tone?: 'ok' | 'muted'; title: string; children?: ReactNode; action?: { label: string; onClick: () => void } }

/** Full-screen message: invalid QR, thank-you, network problem. */
export default function MessageScreen({ icon, tone = 'muted', title, children, action }: Props) {
  const chip = tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-surface-card border-surface-border text-zinc-500';
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-5 ${chip}`}><Icon name={icon} className="w-6 h-6" strokeWidth={1.8} /></div>
      <h1 className="text-white text-xl font-bold mb-2">{title}</h1>
      <div className="text-zinc-500 text-sm leading-relaxed">{children}</div>
      {action && <button type="button" className="btn btn-brand mt-5" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
