/** What a ticket carries about the device. The root console reads these exact keys. */
export interface DiagnosticsPayload {
  appContext: { currentView: string; userRole: string; userName: string; userId: number | string; url: string; sessionDuration: string; sessionStart: string; timestamp: string };
  device: {
    browser: string; browserVersion: string; os: string; type: string; userAgent: string; screen: string; viewport: string; devicePixelRatio: number;
    touch: boolean; timezone: string; language: string; languages: string; memory: number | null; cores: number | null; cookiesEnabled: boolean; onLine: boolean;
  };
  network: { effectiveType: string; downlink: number; rtt: number; saveData: boolean } | null;
  performance: { pageLoad: number | null; domReady: number | null; memoryUsed: string | null };
  consoleErrors: string[];
  socketConnected: boolean;
}

export interface BugReportInput {
  title: string; description: string; steps: string[]; severity: string; category: string;
  diagnostics: DiagnosticsPayload; screenshot: string | null;
}
/** The server stores the ticket for the operator's root console; `email_sent` is always true (kept for the old screen). */
export interface BugReportResult { success?: boolean; ticket_id?: number }
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
