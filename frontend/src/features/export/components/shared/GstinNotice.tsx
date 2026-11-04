import Icon from 'components/ui/base/Icon';
import { useSettings } from 'state/settings/useSettings';

/** Shown until the restaurant's own GSTIN is saved: a filing without it cannot be used. */
export default function GstinNotice() {
  if ((useSettings().gstin ?? '').trim()) return null;
  return (
    <div role="status" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
      <Icon name="warning" className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-amber-400 text-xs leading-relaxed">GSTIN not set — go to <span className="font-semibold">Admin → Restaurant → GST Registration</span> to add your GSTIN before filing.</p>
    </div>
  );
}
