export type TableStatus = 'empty' | 'occupied' | 'waiting_bill';
export interface Table {
  id: string; label: string; seats: number; status: TableStatus;
  occupied_since: string | null; session_id?: string | null; is_parcel?: 0 | 1; // SQLite integer, not a boolean
  customer_name?: string | null; customer_phone?: string | null;
}
export interface TableStats {
  orders_today: number; revenue_today: number; items_today: number;
  avg_order_value: number; last_order_at: string | null;
}
