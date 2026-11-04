import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getKioskContext, getKioskMenu, getKioskOrders, placeKioskOrder } from 'api/restaurant/kiosk.api';
import { ApiError } from 'api/errors';
import ToastProvider from 'state/toast/ToastProvider';
import type { KioskContext } from 'types/restaurant/kiosk';
import type { Order } from 'types/restaurant/orders';
import KioskPage from './KioskPage';

jest.mock('api/restaurant/kiosk.api');
jest.mock('realtime/socket', () => ({ setKioskToken: jest.fn(), getSocket: () => ({ on: jest.fn(), off: jest.fn() }) }));
jest.mock('realtime/useRefetchOnReconnect', () => ({ useRefetchOnReconnect: () => undefined }));
jest.mock('realtime/useSocketEvent', () => ({ useSocketEvent: () => undefined }));

const ctx: KioskContext = {
  kiosk_type: 'table', table_id: 'T1', table_label: 'Table 1', table_seats: 4, table_status: 'empty', is_parcel: false, session_id: null,
  restaurant_name: 'Diner', brand_color: '#f97316', currency_symbol: '₹', tax_percent: '5', logo_url: '', bill_footer: '', address: '', phone: '',
};
const menu = {
  categories: [{ id: 1, name: 'Starters', sort_order: 0 }],
  items: [{ id: 7, name: 'Wings', description: '', price: 100, category_id: 1, category_name: 'Starters', image_path: null, available: 1 }],
};
const sent: Order = { id: 'o1', table_id: 'T1', session_id: 's1', status: 'active', created_at: '2026-01-01T00:00:00Z', delivered_at: null, total: 100, items: [{ menu_item_id: 7, name: 'Wings', price: 100, quantity: 1, note: '' }] };

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const open = () => render(<ToastProvider><MemoryRouter initialEntries={['/kiosk/abc']}><Routes><Route path="/kiosk/:token" element={<KioskPage />} /></Routes></MemoryRouter></ToastProvider>);

beforeEach(() => {
  mocked(getKioskContext).mockResolvedValue(ctx); mocked(getKioskMenu).mockResolvedValue(menu); mocked(getKioskOrders).mockResolvedValue([]);
  mocked(placeKioskOrder).mockReset();
});

test('an invalid QR code says so instead of showing an empty menu', async () => {
  mocked(getKioskContext).mockRejectedValue(new ApiError(404, 'Invalid or expired QR code'));
  open();
  expect(await screen.findByText('Invalid QR code')).toBeInTheDocument();
});

test('adding an item and confirming sends the order, then shows the kitchen status with the server total', async () => {
  mocked(placeKioskOrder).mockResolvedValue(sent);
  mocked(getKioskOrders).mockResolvedValueOnce([]).mockResolvedValue([sent]);
  open();
  fireEvent.click(await screen.findByRole('button', { name: /Wings/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));
  expect(placeKioskOrder).not.toHaveBeenCalled(); // asks first
  const confirm = screen.getAllByRole('button', { name: 'Place Order' }).slice(-1)[0];
  fireEvent.click(confirm);
  await waitFor(() => expect(placeKioskOrder).toHaveBeenCalledWith('abc', [expect.objectContaining({ menu_item_id: 7, quantity: 1 })], null));
  expect(await screen.findByText('Order in kitchen')).toBeInTheDocument();
  expect(screen.getByText('₹105.00')).toBeInTheDocument(); // 100 + 5% tax
});

test('a table that was already served does not open on "bill requested"', async () => {
  mocked(getKioskContext).mockResolvedValue({ ...ctx, table_status: 'waiting_bill', session_id: 's1' });
  mocked(getKioskOrders).mockResolvedValue([{ ...sent, status: 'delivered' }]);
  open();
  expect(await screen.findByText('All items ready')).toBeInTheDocument();
  expect(screen.queryByText('Bill requested')).not.toBeInTheDocument();
});
