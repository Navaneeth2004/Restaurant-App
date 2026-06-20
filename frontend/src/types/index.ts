export interface Settings {
  restaurant_name: string;
  address: string;
  phone: string;
  bill_footer: string;
  tax_percent: string;
  brand_color: string;
  currency_symbol: string;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id: number;
  category_name: string;
  image_path: string | null;
  available: number; // 0 or 1 from SQLite
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  status: 'empty' | 'occupied' | 'waiting_bill';
  occupied_since: string | null; // ISO timestamp of active order start
  session_id?: string | null;
}

export interface OrderItem {
  id?: number;
  order_id?: string;
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

export interface Order {
  id: string;
  table_id: string;
  session_id?: string;
  status: 'active' | 'delivered' | 'closed';
  created_at: string;
  delivered_at: string | null;
  total: number;
  items: OrderItem[];
  payment_method?: string | null;
  payment_details?: any;
  change_amount?: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  /**
   * Amount actually collected from the customer, including tax.
   * May differ from `total * (1 + taxPct)` (the bill) due to discounts,
   * rounding, card surcharges, or a customer paying extra. Null/undefined
   * on orders closed before this field existed — treat as "same as bill".
   */
  amount_paid?: number | null;
}

export interface Staff {
  id: number;
  name: string;
  role: 'admin' | 'waiter' | 'kitchen';
  active: number;
}

export interface ReportSummary {
  revenue: number;
  ordersCount: number;
  activeOrders: number;
  occupiedTables: number;
  topItems: { name: string; total_qty: number; total_rev: number }[];
  paymentBreakdown?: { payment_method: string | null; count: number; total: number }[];
  /** Sum of all closed orders' bill totals today, incl. tax */
  billTotalInclTax?: number;
  /** Sum of all closed orders' amount_paid today, incl. tax (falls back to bill if unset) */
  paidTotal?: number;
  /** paidTotal - billTotalInclTax — positive means overpaid overall, negative means underpaid/discounted */
  paidVsBillDiff?: number;
}

export interface RevenueDay {
  day: string;
  revenue: number;
  orders: number;
}

export type UserRole = 'admin' | 'waiter' | 'kitchen';

export interface AuthUser {
  id: number;
  name: string;
  role: UserRole;
}

export type ViewType = 'waiter' | 'kitchen' | 'admin' | 'reports' | 'bugreport';