export interface TopItem { name: string; total_qty: number; total_rev: number }
export interface ReportSummary {
  revenue: number; ordersCount: number; activeOrders: number; occupiedTables: number; topItems: TopItem[];
}
export interface RevenueDay { day: string; revenue: number; orders: number }
