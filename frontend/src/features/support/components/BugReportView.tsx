import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { SEVERITIES, TICKET_LIMITS } from 'config/support';
import CategoryPicker from '../form/CategoryPicker';
import SeverityPicker from '../form/SeverityPicker';
import StepsRecorder from '../form/StepsRecorder';
import { useBugReport } from '../hooks/useBugReport';
import DiagnosticsPreview from '../side/DiagnosticsPreview';
import ScreenshotField from '../side/ScreenshotField';
import SentNotice from './SentNotice';

export default function BugReportView() {
  const f = useBugReport();
  if (f.sentId !== undefined) return <SentNotice ticketId={f.sentId} onAnother={f.reset} />;
  const sev = SEVERITIES.find(s => s.key === f.severity) ?? SEVERITIES[1];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3.5 border-b border-surface-border bg-surface-card/50 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 text-red-400"><Icon name="alert" className="w-3.5 h-3.5" /></div>
        <div className="min-w-0"><h2 className="font-bold text-white text-sm leading-tight">Report a Bug</h2><p className="text-zinc-500 text-[11px] truncate">Device info is collected automatically — just describe what happened</p></div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        <div className="flex-1 overflow-y-auto lg:border-r lg:border-surface-border">
          <div className="px-5 py-5 space-y-5 max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Bug details</p>
            <SeverityPicker value={f.severity} onChange={f.setSeverity} />
            <CategoryPicker value={f.category} onChange={f.setCategory} />
            <div><label className="label" htmlFor="bug-title">Bug title <span className="text-red-400">*</span></label>
              <input id="bug-title" className="input" placeholder='e.g. "Order disappears after adding items to Table 3"' maxLength={TICKET_LIMITS.title} value={f.title} onChange={e => f.setTitle(e.target.value)} />
              <p className="text-zinc-700 text-[10px] mt-1">A clear, specific title helps the developer find and fix it faster.</p></div>
            <div><label className="label" htmlFor="bug-desc">What went wrong? <span className="text-red-400">*</span></label>
              <textarea id="bug-desc" className="input resize-none" rows={4} placeholder="Describe what you expected to happen and what actually happened." value={f.description} onChange={e => f.setDescription(e.target.value)} /></div>
            <div><p className="label mb-2">Steps to reproduce <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional but very helpful)</span></p><StepsRecorder steps={f.steps} onChange={f.setSteps} /></div>
          </div>
        </div>
        <div className="lg:w-80 xl:w-96 flex-shrink-0 overflow-y-auto border-t border-surface-border lg:border-t-0">
          <div className="px-5 py-5 space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Attachments &amp; submit</p>
            <DiagnosticsPreview diag={f.diagnostics} />
            <ScreenshotField value={f.screenshot} onChange={f.setScreenshot} />
            {f.error && <div role="alert" className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><Icon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" />{f.error}</div>}
            <div className="pb-6">
              <button type="button" onClick={() => void f.submit()} disabled={f.busy || !f.ready} className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: f.busy ? '#6b7280' : sev.color }}>
                {f.busy ? <><Spinner />Sending ticket…</> : 'Send Bug Report'}
              </button>
              <p className="text-zinc-600 text-[10px] text-center mt-2.5 leading-relaxed">Your ticket goes to support with the diagnostics shown above.<br />{f.screenshot ? 'The screenshot is attached.' : 'No personal data beyond your name and role is included.'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
