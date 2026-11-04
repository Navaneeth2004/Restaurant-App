import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updatePayment } from 'api/restaurant/orders.api';
import { groupVisits } from 'lib/orders/visits';
import type { Order } from 'types/restaurant/orders';
import PaymentEditModal from './PaymentEditModal';

jest.mock('api/restaurant/orders.api', () => ({ updatePayment: jest.fn() }));
jest.mock('state/settings/useSettings', () => ({ useSettings: () => ({ currency_symbol: '₹', b2b_enabled: 'true', tax_percent: '5' }) }));
const mockUpdate = updatePayment as jest.Mock;

const order = (o: Partial<Order>): Order => ({
  id: 'o', table_id: '3', session_id: 's', status: 'closed', created_at: '2026-01-05T10:30:45.000Z', delivered_at: '2026-01-05T10:40:00.000Z',
  total: 100, items: [{ menu_item_id: 1, name: 'Wings', price: 100, quantity: 1, note: '' }], tax_percent_snapshot: 18, ...o,
});
const visit = (extra: Partial<Order> = {}) => groupVisits([order({ id: 'first' }), order({ id: 'last', created_at: '2026-01-05T11:00:00.000Z', total: 0, items: [], payment_method: 'upi', amount_paid: 118, ...extra })], 5)[0];

beforeEach(() => { mockUpdate.mockReset(); mockUpdate.mockResolvedValue({ success: true }); });

test('saving untouched sends the visit-rate total and NO new date, to the newest round', async () => {
  const onSaved = jest.fn();
  render(<PaymentEditModal visit={visit()} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByText('₹118.00', { selector: 'div' })).toBeInTheDocument();   // 100 + 18% — not today's 5%
  fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const [id, body] = mockUpdate.mock.calls[0];
  expect(id).toBe('last');
  expect(body).toMatchObject({ payment_method: 'upi', amount_paid: 118, order_type: 'dine_in' });
  expect('created_at' in body).toBe(false);
});

test('changing the time sends a new start', async () => {
  render(<PaymentEditModal visit={visit()} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Order time'), { target: { value: '09:15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  expect(mockUpdate.mock.calls[0][1].created_at).toEqual(expect.any(String));
});

test('a short new GSTIN blocks saving; clearing a saved one explains the server keeps it', () => {
  render(<PaymentEditModal visit={visit()} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Customer GSTIN'), { target: { value: 'abc' } });
  expect(screen.getByRole('alert')).toHaveTextContent('15');
  expect(screen.getByRole('button', { name: 'Save payment' })).toBeDisabled();
});

test('a saved GSTIN that is blanked out is explained and left out of the request', async () => {
  render(<PaymentEditModal visit={visit({ customer_gstin: '32ABCDE1234F1Z5' })} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Customer GSTIN'), { target: { value: '' } });
  expect(screen.getByText(/cannot be removed here/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  expect(mockUpdate.mock.calls[0][1].customer_gstin).toBeUndefined();
});
