import type { RevenueReport, RevenueVisit } from 'types/office/export';
import { count, money, textCell, toCsv } from './csv';
import { dailyCsv, revenueJson, visitsCsv } from './revenue-csv';

const visit = (over: Partial<RevenueVisit> = {}): RevenueVisit => ({
  id: 'o1', session_id: 's1', table: 'Table 1', order_type: 'dine_in', created_at: '2026-05-10T06:30:00.000Z', status: 'closed',
  customer_name: null, customer_phone: null, customer_gstin: null, payment_method: 'cash', split_details: null, change_amount: 0,
  subtotal: 100, tax: 5, total_incl_tax: 105, amount_paid: 105, diff_from_bill: 0,
  items: [{ name: 'Wings', qty: 2, price: 50, note: '', subtotal: 100 }], ...over,
});
const report = (orders: RevenueVisit[]): RevenueReport => ({
  generated_at: 'x', restaurant: 'Diner', period: { from: '2026-05-01', to: '2026-05-31' },
  summary: { total_revenue_pretax: 100, tax_collected: 5, total_incl_tax: 105, total_amount_paid: 105, tax_percent: 5, total_orders: orders.length, total_items_sold: 2, avg_order_value: 100, currency: '₹' },
  order_type_breakdown: [], payment_breakdown: [], top_items: [], orders,
  daily_breakdown: [{ date: '2026-05-10', revenue: 100, orders: 1, items_sold: 2, tax: 5, total_incl_tax: 105 }],
});

test('cells are quoted only when needed and quotes are doubled', () => {
  expect(textCell('plain')).toBe('plain');
  expect(textCell('a, b')).toBe('"a, b"');
  expect(textCell('say "hi"')).toBe('"say ""hi"""');
  expect(textCell('two\nlines')).toBe('"two\nlines"');
});

test('text that could run as a formula is defused, phone numbers are left alone', () => {
  expect(textCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(textCell('@cmd')).toBe("'@cmd");
  expect(textCell('+91 98765 43210')).toBe('+91 98765 43210');
});

test('numbers are written bare with fixed decimals, never quoted or prefixed with a symbol', () => {
  expect(toCsv(['a', 'b'], [[money(-5), count(3)]])).toBe('\uFEFFa,b\r\n-5.00,3\r\n');
  expect(toCsv(['a'], [[money(NaN)]])).toBe('\uFEFFa\r\n\r\n');
});

test('the visits file has one header and one row per visit, with local date and readable items', () => {
  const csv = visitsCsv(report([visit({ customer_name: 'Ravi, Jr', items: [{ name: 'Fries', qty: 1, price: 9, note: 'no salt', subtotal: 9 }, { name: 'Cola', qty: 2, price: 2, note: '', subtotal: 4 }] })]), '₹');
  const lines = csv.trim().split('\r\n');
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain('Total (₹)');
  expect(lines[1]).toMatch(/^2026-05-1\d,\d\d:\d\d,Table 1,Dine in,"Ravi, Jr",,,1 x Fries \(no salt\); 2 x Cola,100\.00,5\.00,105\.00,105\.00,0\.00,Cash,$/);
});

test('a split payment is spelled out and an unpaid-method visit leaves the cell empty', () => {
  const split = visitsCsv(report([visit({ payment_method: 'split', split_details: [{ method: 'cash', amount: 60 }, { method: 'upi', amount: 45 }] })]), '₹');
  expect(split).toContain(',Split,Cash 60.00 + UPI 45.00');
  expect(visitsCsv(report([visit({ payment_method: null })]), '₹').trim().split('\r\n')[1]).toMatch(/,0\.00,,$/);
});

test('visits are listed oldest first', () => {
  const csv = visitsCsv(report([visit({ id: 'b', created_at: '2026-05-12T06:00:00Z', table: 'B' }), visit({ id: 'a', created_at: '2026-05-10T06:00:00Z', table: 'A' })]), '₹');
  expect(csv.indexOf(',A,')).toBeLessThan(csv.indexOf(',B,'));
});

test('the daily file and the JSON file are tidy', () => {
  expect(dailyCsv(report([]), '₹')).toBe('\uFEFFDate,Visits,Items sold,Revenue before tax (₹),Tax (₹),Total incl. tax (₹)\r\n2026-05-10,1,2,100.00,5.00,105.00\r\n');
  expect(revenueJson(report([]))).toMatch(/^\{\n {2}"generated_at"/);
});
