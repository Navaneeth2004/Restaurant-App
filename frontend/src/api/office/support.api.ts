import { request } from '../http';
import type { BugReportInput, BugReportResult, SavedBugReport } from 'types/office/support';

export const submitBugReport = (b: BugReportInput) => request<BugReportResult>('/bug-report', { method: 'POST', json: b });
export const listBugReports = (signal?: AbortSignal) => request<SavedBugReport[]>('/bug-report', { signal });
