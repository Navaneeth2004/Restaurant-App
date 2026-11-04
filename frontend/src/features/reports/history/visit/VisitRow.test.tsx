import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { deleteRecords } from 'api/restaurant/orders.api';
import { groupVisits } from 'lib/orders/visits';
import type { Order } from 'types/restaurant/orders';
import VisitRow from './VisitRow';

jest.mock('api/restaurant/orders.api', () => ({ deleteRecords: jest.fn(), updatePayment: jest.fn() }));
jest.mock('api/access/staff.api', () => ({ checkPin: jest.fn() }));
jest.mock('components/pin/PinModal', () => ({ __esModule: true, default: ({ onSuccess }: { onSuccess: (p: string) => void }) => <button onClick={() => onSuccess('4826')}>enter pin</button> }));
const mockDelete = deleteRecords as jest.Mock;

const o = (id: string): Order => ({ id, table_id: '3', session_id: 's', status: 'closed', created_at: '2026-01-05T10:00:00Z', delivered_at: '2026-01-05T10:20:00Z', total: 100,
  items: [{ menu_item_id: 1, name: 'Wings', price: 100, quantity: 1, note: '' }], tax_percent_snapshot: 5, payment_method: 'cash' });
const visit = groupVisits([o('a'), o('b')], 5)[0];

beforeEach(() => { mockDelete.mockReset(); mockDelete.mockResolvedValue({ success: true }); });

test('delete explains, asks for the PIN, deletes every round of the visit, then reloads the list', async () => {
  const onChanged = jest.fn();
  render(<VisitRow visit={visit} sym="₹" onChanged={onChanged} />);
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
  expect(await screen.findByText('Delete this record?')).toBeInTheDocument();
  expect(mockDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'enter pin' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(mockDelete).toHaveBeenCalledWith(['a', 'b'], '4826');
});

test('cancelling at the first step deletes nothing', async () => {
  render(<VisitRow visit={visit} sym="₹" onChanged={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(mockDelete).not.toHaveBeenCalled();
});
