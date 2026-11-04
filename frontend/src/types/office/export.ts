export interface GstPeriod { from: string; to: string }
export interface TaxBucket { taxable_value: number; central_tax: number; state_ut_tax: number }

export interface Gstr1Preview {
  period: GstPeriod; return_period: string; gstin: string; legal_name: string; state_name: string; state_code: string;
  sac_code: string;
  /** The CURRENT tax setting (each bill is filed at the rate it was closed with). */
  tax_rate: number;
  order_count: number; item_qty: number;
  b2cs: TaxBucket & { invoice_count: number };
  b2b: TaxBucket & { invoice_count: number; gstin_count: number };
  totals: TaxBucket & { total_tax: number; total_incl_tax: number };
  hsn_summary: { hsn_sc: string; desc: string; uqc: string; qty: number; taxable: number; central_tax: number; state_ut_tax: number }[];
  doc_issued: number;
}

export interface ItcFigures { integrated_tax: number | null; central_tax: number | null; state_ut_tax: number | null; cess: number | null }
export interface Gstr3b {
  period: GstPeriod; gstin: string; legal_name: string; tax_rate: number; order_count: number;
  outward_taxable: {
    total_taxable_value: number; integrated_tax: number; central_tax: number; state_ut_tax: number; cess: number;
    total_tax: number; total_incl_tax: number;
  };
  itc_claimed: ItcFigures & { note: string };
  tax_paid: { integrated_tax: number; central_tax: number; state_ut_tax: number; cess: number };
}

export interface Gstr9 {
  fy: string; period: GstPeriod; gstin: string; legal_name: string; state_name: string; sac_code: string;
  tax_rate: number; order_count: number; session_count: number;
  outward: {
    b2b_taxable: number; b2b_cgst: number; b2b_sgst: number; b2c_taxable: number; b2c_cgst: number; b2c_sgst: number;
    total_taxable: number; total_cgst: number; total_sgst: number; total_igst: number; total_cess: number; total_incl_tax: number;
  };
  tax_paid: { integrated_tax: number; central_tax: number; state_ut_tax: number; cess: number; total: number };
  itc_note: string;
  hsn_summary: { hsn_sc: string; desc: string; uqc: string; qty: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number }[];
  monthly_breakdown: { month: string; orders: number; sessions: number; taxable: number; cgst: number; sgst: number; tax: number }[];
}

export interface MenuImportResult {
  success: boolean; categories_added: number; items_added: number; items_skipped: number; images_imported?: number;
}

/** `GET /export/revenue` (JSON). Money is in the restaurant's currency; `revenue` is before tax. */
export interface RevenueVisit {
  id: string; session_id: string | null; table: string; order_type: 'dine_in' | 'parcel'; created_at: string; status: string;
  customer_name: string | null; customer_phone: string | null; customer_gstin: string | null;
  payment_method: string | null; split_details: { method: string; amount: number }[] | null; change_amount: number;
  subtotal: number; tax: number; total_incl_tax: number; amount_paid: number; diff_from_bill: number;
  items: { name: string; qty: number; price: number; note: string; subtotal: number }[];
}
export interface RevenueReport {
  generated_at: string; restaurant: string; period: GstPeriod;
  summary: {
    total_revenue_pretax: number; tax_collected: number; total_incl_tax: number; total_amount_paid: number;
    tax_percent: number; total_orders: number; total_items_sold: number; avg_order_value: number; currency: string;
  };
  order_type_breakdown: { type: 'dine_in' | 'parcel'; label: string; count: number; revenue: number }[];
  payment_breakdown: { method: string; count: number; revenue: number }[];
  daily_breakdown: { date: string; revenue: number; orders: number; items_sold: number; tax: number; total_incl_tax: number }[];
  top_items: { name: string; qty_sold: number; revenue: number }[];
  orders: RevenueVisit[];
}
