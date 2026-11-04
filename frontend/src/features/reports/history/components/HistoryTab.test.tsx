import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getReportHistory } from 'api/office/reports.api';
import type { Order } from 'types/restaurant/orders';
import HistoryTab from './HistoryTab';

jest.mock('api/office/reports.api', () => ({ getReportHistory: jest.fn() }));
jest.mock('api/restaurant/orders.api', () => ({ deleteRecords: jest.fn(), updatePayment: jest.fn() }));
const mockHistory = getReportHistory as jest.Mock;

const row = (id: string, o: Partial<Order> = {}): Order => ({ id, table_id: '3', session_id: 's1', status: 'closed', created_at: '2026-01-05T10:00:00Z', delivered_at: '2026-01-05T10:20:00Z',
  total: 100, items: [{ menu_item_id: 1, name: 'Wings', price: 100, quantity: 1, note: '' }], tax_percent_snapshot: 18, payment_method: 'cash', ...o });

beforeEach(() => mockHistory.mockReset());

test('rounds of one visit show as one visit, billed at the rate stored with it, and ask the server for the full limit', async () => {
  mockHistory.mockResolvedValue([row('a'), row('b', { created_at: '2026-01-05T11:00:00Z' })]);
  render(<HistoryTab />);
  expect(await screen.findByText('1 visit')).toBeInTheDocument();
  expect(screen.getAllByText('₹236.00')).toHaveLength(2);   // 200 + 18%: the total pill and the row
  expect(mockHistory).toHaveBeenCalledWith(expect.any(Object), expect.anything(), 1000);
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  expect(screen.getByText('Tax (18%)')).toBeInTheDocument();
});

test('a full page of rows warns that older orders were cut off', async () => {
  mockHistory.mockResolvedValue(Array.from({ length: 1000 }, (_, i) => row(`o${i}`, { session_id: `s${i}` })));
  render(<HistoryTab />);
  expect(await screen.findByText(/more than 1000 orders/)).toBeInTheDocument();
});

test('search narrows the loaded visits without a new request', async () => {
  mockHistory.mockResolvedValue([row('a', { customer_name: 'Rahul' }), row('b', { session_id: 's2', customer_name: 'Meera' })]);
  render(<HistoryTab />);
  await screen.findByText('2 visits');
  fireEvent.change(screen.getByLabelText('Search visits'), { target: { value: 'meera' } });
  expect(await screen.findByText(/1 visit/)).toBeInTheDocument();
  expect(mockHistory).toHaveBeenCalledTimes(1);
});

test('an inverted range blocks Search and shows why', async () => {
  mockHistory.mockResolvedValue([]);
  render(<HistoryTab />);
  await waitFor(() => expect(mockHistory).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2000-01-01' } });
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
});
