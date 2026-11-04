import { useRef } from 'react';
import Icon from 'components/ui/base/Icon';
import { useToast } from 'state/toast/useToast';
import { captureScreen, imageFileToJpeg } from 'lib/support/screenshot';

interface Props { value: string | null; onChange: (v: string | null) => void }

/** Optional picture: share-a-screen capture or an uploaded image. Both end up as a JPEG the server accepts. */
export default function ScreenshotField({ value, onChange }: Props) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);

  const capture = async (): Promise<void> => {
    const url = await captureScreen();
    if (url) { onChange(url); toast('Screenshot captured', 'success'); }
    else toast('Could not capture the screen — permission may have been denied', 'error');
  };
  const upload = async (f: File | undefined): Promise<void> => {
    if (file.current) file.current.value = '';
    if (!f) return;
    const url = await imageFileToJpeg(f);
    if (url) onChange(url);
    else toast('That image could not be used (unreadable or too large).', 'error');
  };

  return (
    <div>
      <p className="label mb-2">Screenshot <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></p>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-surface-border">
          <img src={value} alt="Attached screenshot" className="w-full max-h-48 object-contain bg-zinc-900" />
          <button type="button" aria-label="Remove screenshot" onClick={() => onChange(null)} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"><Icon name="x" className="w-3.5 h-3.5" /></button>
          <p className="px-3 py-2 bg-surface-raised border-t border-surface-border text-emerald-400 text-xs font-medium flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5" />Screenshot attached</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm flex-1" onClick={() => void capture()}>Capture screen</button>
          <button type="button" className="btn btn-sm flex-1" onClick={() => file.current?.click()}><Icon name="upload" className="w-3.5 h-3.5" />Upload image</button>
          <input ref={file} type="file" accept="image/*" aria-label="Screenshot file" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}
