import { useState } from 'react';
import Toggle from 'components/ui/base/Toggle';
import type { FeatureDef, FeatureSwitch } from 'types/office/root';

interface Props {
  feature: FeatureDef; current: FeatureSwitch | undefined; busy: boolean;
  onSet: (feature: string, off: boolean, message: string) => Promise<boolean>;
}

/** One feature's global switch. While it is on you can type the message restaurants will see, then switch it off. */
export default function SwitchRow({ feature, current, busy, onSet }: Props) {
  const [message, setMessage] = useState('');
  const off = current !== undefined;
  const flip = (): void => {
    if (busy) return;
    void onSet(feature.key, !off, message).then(ok => { if (ok) setMessage(''); });
  };
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
      <div className="min-w-0 flex-1 basis-48">
        <p className={`text-sm ${off ? 'text-red-400 font-semibold' : 'text-zinc-200'}`}>{feature.label}</p>
        <p className="font-mono text-[10px] text-zinc-600">{feature.key}</p>
      </div>
      {current ? (
        <p className="text-red-400/80 text-xs flex-1 basis-48">{current.message ? `Message: ${current.message}` : 'Off for everyone (default message).'}</p>
      ) : (
        <input aria-label={`Message for ${feature.label}`} className="input flex-1 basis-48 py-1.5 text-xs" maxLength={200} placeholder="Message restaurants see when it is off (optional)" value={message} onChange={e => setMessage(e.target.value)} />
      )}
      <Toggle enabled={!off} label={`${feature.label} for every restaurant`} onChange={flip} />
    </li>
  );
}
