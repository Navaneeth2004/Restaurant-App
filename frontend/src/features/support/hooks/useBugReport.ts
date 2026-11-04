import { useState } from 'react';
import { submitBugReport } from 'api/office/support.api';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { collectDiagnostics } from 'lib/support/diagnostics';
import { useAuth } from 'state/auth/useAuth';
import { usePreviousView } from 'state/nav/previous-view';
import type { Severity } from 'config/support';

/** The form state of one ticket, plus a fresh diagnostics snapshot taken at the moment of sending. */
export function useBugReport() {
  const { user } = useAuth();
  const where = usePreviousView() ?? 'unknown';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [category, setCategory] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sentId, setSentId] = useState<number | null | undefined>(undefined);
  const [diagnostics] = useState(() => collectDiagnostics(user, where));
  const [busy, run] = useBusy();

  const ready = !!title.trim() && !!description.trim() && !!category;
  const submit = (): Promise<void | undefined> => run(async () => {
    if (!ready) { setError(!title.trim() ? 'Please enter a title for the bug.' : !description.trim() ? 'Please describe what went wrong.' : 'Please select a category.'); return; }
    setError('');
    try {
      const r = await submitBugReport({ title: title.trim(), description: description.trim(), steps, severity, category, diagnostics: collectDiagnostics(user, where), screenshot });
      setSentId(r.ticket_id ?? null);
    } catch (e) { setError(errorMessage(e, 'Failed to send the report. Please try again.')); }
  });
  const reset = (): void => { setTitle(''); setDescription(''); setSteps([]); setSeverity('medium'); setCategory(''); setScreenshot(null); setError(''); setSentId(undefined); };

  return { title, setTitle, description, setDescription, steps, setSteps, severity, setSeverity, category, setCategory, screenshot, setScreenshot, error, setError, sentId, diagnostics, busy, ready, submit, reset, role: user?.role };
}
