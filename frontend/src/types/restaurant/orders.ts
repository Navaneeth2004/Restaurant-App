export interface OrderItem {
  id?: number; order_id?: string; menu_item_id: number; name: string; price: number; quantity: number; note: string;
}
export type OrderStatus = 'active' | 'delivered' | 'billed_direct' | 'closed';
export type OrderType = 'dine_in' | 'parcel';
export interface SplitPayment { method: string; amount: number }

export interface Order {
  id: string; table_id: string; session_id?: string | null; status: OrderStatus;
  created_at: string; delivered_at: string | null; total: number; items: OrderItem[];
  payment_method?: string | null;
  payment_details?: SplitPayment[] | { received: number; change: number } | string | null;
  change_amount?: number; amount_paid?: number | null; order_type?: OrderType | null;
  customer_name?: string | null; customer_phone?: string | null; customer_gstin?: string | null;
  edited_at?: string | null;
  /** Tax rate in force when the visit was closed (null on legacy rows). */
  tax_percent_snapshot?: number | null;
  invoice_no?: number | null;
  closed_at?: string | null;
}
export interface NewOrderItem { menu_item_id: number; name: string; price: number; quantity: number; note: string }
export interface PaymentInput {
  payment_method: string; payment_details?: SplitPayment[] | { received: number; change: number } | null;
  change_amount?: number; customer_name?: string; customer_phone?: string; customer_gstin?: string;
  amount_paid?: number; order_type?: OrderType;
  /** The rounds the bill was built from: the server refuses to close if another round was added meanwhile. */
  order_ids?: string[];
}
export interface PaymentEditInput extends PaymentInput { created_at?: string }
export interface DeletedRecord {
  id: number; deleted_at: string; deleted_by: string | null; table_id: string; table_label: string | null;
  visit_at: string | null; order_count: number; subtotal: number; bill_total: number; amount_paid: number | null;
  payment_method: string | null; order_type: string | null; customer_name: string | null;
  customer_phone: string | null; customer_gstin: string | null; was_edited: number; edited_at: string | null;
  items: { name: string; price: number; quantity: number; note: string }[];
}
