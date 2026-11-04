import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { closeOrder } from 'api/restaurant/orders.api';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';
import BillModal from './BillModal';

jest.mock('api/restaurant/orders.api', () => ({ closeOrder: jest.fn() }));
const mockClose = closeOrder as jest.Mock;

const table: Table = { id: '3', label: 'Table 3', seats: 4, status: 'waiting_bill', occupied_since: null };
const orders: Order[] = [{
  id: 'o1', table_id: '3', status: 'delivered', created_at: '2026-01-01T10:00:00Z', delivered_at: '2026-01-01T10:10:00Z', total: 20,
  items: [{ id: 1, menu_item_id: 1, name: 'Wings', price: 10, quantity: 2, note: '' }],
}];

beforeEach(() => { mockClose.mockReset(); mockClose.mockResolvedValue(undefined); });

test('paying without opening the Payment tab asks first, then closes once with the bill total', async () => {
  const onClosed = jest.fn();
  render(<BillModal orders={orders} table={table} onClose={jest.fn()} onClosed={onClosed} />);
  fireEvent.click(screen.getByRole('button', { name: /Mark Paid/ }));
  expect(await screen.findByText('No payment method selected', { selector: 'h3' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark paid (cash)' }));
  await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockClose).toHaveBeenCalledWith('o1', expect.objectContaining({ payment_method: 'cash', amount_paid: 21, order_type: 'dine_in' }));
});

test('a big shortfall needs confirmation and can be cancelled', async () => {
  render(<BillModal orders={orders} table={table} onClose={jest.fn()} onClosed={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Payment' }));
  fireEvent.change(screen.getByLabelText('Amount paid'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: /Mark Paid/ }));
  expect(await screen.findByText(/less than the bill/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));
  expect(mockClose).not.toHaveBeenCalled();
});
