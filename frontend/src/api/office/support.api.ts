import { request } from '../http';
import type { BugReportInput, BugReportResult } from 'types/office/support';

/** Tickets are read in the root console, so there is no "list my tickets" call. */
export const submitBugReport = (b: BugReportInput) => request<BugReportResult>('/bug-report', { method: 'POST', json: b });
