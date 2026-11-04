import type { DiagnosticsPayload, TicketStatus } from './support';

export interface RootOverview {
  restaurants: { total: number; by_status: Record<string, number> };
  owners: number; devices: number;
  tickets: { open: number; critical_open: number };
  /** null when the realtime server is not attached. */
  connected_sockets: number | null;
  trial_ending_soon: { id: string; name: string; trial_ends_at: string }[];
  recent_tickets: { id: number; restaurant_id: string; restaurant_name: string | null; title: string; severity: string; status: TicketStatus; created_at: string }[];
  recently_active: { id: string; name: string; last_seen: string | null }[];
  server: { node: string; uptime_s: number; memory_mb: number; deployment: string };
}

export interface RootConfig {
  plans: string[];
  limit_keys: { key: string; label: string }[];
  plan_defaults: Record<string, Record<string, number>>;
  ticket_statuses: string[];
  enforce_trial: boolean;
}

export interface RestaurantSummary {
  id: string; name: string; status: string; plan: string; trial_ends_at: string | null; created_at: string;
  owner_phone: string; owner_id: string; devices: number; last_seen_at: string | null; open_tickets: number; db_bytes: number;
}

export interface RootDevice {
  id: string; name: string; role_lock: string | null; created_via: string | null; created_at: string;
  last_seen_at: string | null; last_ip: string | null; user_agent: string | null;
}

/** All counts are missing when the restaurant's own database could not be opened (then `database.error` says why). */
export interface RestaurantCounts {
  orders_total?: number; orders_closed?: number; orders_active?: number; orders_today?: number; staff_active?: number;
  menu_items?: number; categories?: number; tables?: number; deleted_records?: number;
}

export interface RestaurantDetail {
  id: string; name: string; status: string; plan: string; trial_ends_at: string | null; created_at: string; updated_at: string | null;
  notes: string; suspended_reason: string | null; suspended_at: string | null;
  limits_override: Record<string, number>; limits_effective: Record<string, number | undefined>;
  owner: { id: string; phone: string; disabled: number; created_at: string } | undefined;
  devices: RootDevice[];
  live: { staff_sockets: number; device_sockets: number };
  storage: { db_bytes: number; db_file: string; uploads_bytes: number; uploads_count: number };
  database: { schema_version: number | null; error: string | null };
  counts: RestaurantCounts;
  activity: { last_order_at?: string | null; first_order_at?: string | null };
  settings: { tax_percent?: string; currency?: string; state?: string; gstin_set?: boolean; b2b_enabled?: boolean; kitchen_overdue_mins?: string };
  tickets: { total: number; open: number };
}

export interface NewRestaurantInput {
  restaurant_name: string; owner_phone: string; owner_password?: string; admin_name?: string; admin_pin?: string;
  plan: string; trial_days?: string; notes?: string;
}
/** `temp_owner_password` and `admin_pin` are shown ONCE (null when the operator typed them). */
export interface CreatedRestaurant { id: string; name: string; owner_phone: string; temp_owner_password: string | null; admin_pin: string | null }

export interface RestaurantPatch {
  name?: string; plan?: string; notes?: string; trial_ends_at?: string | null; limits?: Record<string, number | null>;
}

export interface TicketRow {
  id: number; restaurant_id: string; restaurant_name: string | null; title: string; severity: string; category: string | null;
  status: TicketStatus; submitted_by: string | null; submitted_role: string | null; created_at: string; updated_at: string; has_screenshot: number;
}
export interface TicketFilter { status: string; severity: string; q: string; restaurant: string }

export interface TicketDetail extends Omit<TicketRow, 'has_screenshot'> {
  description: string; steps: string[]; root_note: string | null; resolved_at: string | null;
  device_name: string | null; ip: string | null; user_agent: string | null;
  diagnostics: Partial<DiagnosticsPayload> | null; has_screenshot: boolean;
  restaurant: { id: string; name: string; status: string; plan: string } | null;
}

export interface AuditRow { id: number; at: string; owner_id: string | null; owner_phone: string | null; action: string; target: string | null; detail: string | null; ip: string | null }
