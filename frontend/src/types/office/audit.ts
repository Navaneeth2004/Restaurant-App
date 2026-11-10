export type AuditSource = 'all' | 'app' | 'root';
/** `app` = what restaurants did, `root` = what the operator did in the console. */
export interface AuditFilter { q: string; source: AuditSource; limit: number; offset: number }