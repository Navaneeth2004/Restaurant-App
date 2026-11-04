import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { revenueReport } from 'api/office/export.api';
import { downloadBlob } from 'lib/browser/download';
import type { RevenueReport } from 'types/office/export';
import RevenueSection from './RevenueSection';

jest.mock('api/office/export.api', () => ({ revenueReport: jest.fn() }));
jest.mock('lib/browser/download', () => ({ downloadBlob: jest.fn() }));
const load = revenueReport as jest.Mock;

const data: RevenueReport = {
  generated_at: 'x', restaurant: 'Diner', period: { from: '2026-05-01', to: '2026-05-31' },
  summary: { total_revenue_pretax: 200, tax_collected: 10, total_incl_tax: 210, total_amount_paid: 205, tax_percent: 5, total_orders: 2, total_items_sold: 4, avg_order_value: 100, currency: '₹' },
  order_type_breakdown: [{ type: 'dine_in', label: 'Dine In', count: 2, revenue: 200 }],
  payment_breakdown: [{ method: 'upi', count: 2, revenue: 200 }],
  daily_breakdown: [{ date: '2026-05-10', revenue: 200, orders: 2, items_sold: 4, tax: 10, total_incl_tax: 210 }],
  top_items: [{ name: 'Wings', qty_sold: 4, revenue: 200 }], orders: [],
};
beforeEach(() => { load.mockReset(); load.mockResolvedValue(data); (downloadBlob as jest.Mock).mockReset(); });

test('shows the figures without "undefined" and downloads a file named with the period', async () => {
  render(<RevenueSection />);
  expect(await screen.findByText('₹205.00')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  fireEvent.click(screen.getByRole('button', { name: /Visits \(CSV\)/ }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Revenue_visits_2026-05-01_to_2026-05-31.csv'));
});

test('a period with no visits shows a message and no download buttons', async () => {
  load.mockResolvedValue({ ...data, summary: { ...data.summary, total_orders: 0 } });
  render(<RevenueSection />);
  expect(await screen.findByText(/No closed visits/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /CSV/ })).not.toBeInTheDocument();
});
