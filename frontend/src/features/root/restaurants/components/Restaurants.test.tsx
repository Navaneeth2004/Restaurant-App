import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRestaurant, deleteRestaurant, getFeatureAdmin, getRestaurant, listRestaurants, rootConfig } from 'api/platform/root.api';
import type { RestaurantDetail as Detail, RootConfig } from 'types/office/root';
import RestaurantsTab from './RestaurantsTab';

jest.mock('api/platform/root.api', () => ({ listRestaurants: jest.fn(), rootConfig: jest.fn(), createRestaurant: jest.fn(), getRestaurant: jest.fn(), getFeatureAdmin: jest.fn(), patchRestaurant: jest.fn(), deleteRestaurant: jest.fn(), suspendRestaurant: jest.fn(), activateRestaurant: jest.fn(), revokeRestaurantDevices: jest.fn(), resetOwnerPassword: jest.fn() }));

const config: RootConfig = { plans: ['trial', 'standard'], limit_keys: [{ key: 'max_staff', label: 'Max staff accounts' }], plan_defaults: { trial: {}, standard: {} }, ticket_statuses: [], enforce_trial: false };
const row = { id: 'abc1234567', name: 'Test Diner', status: 'active', plan: 'trial', trial_ends_at: null, created_at: '2026-01-01T00:00:00Z', owner_phone: '919876543210', owner_id: 'o', devices: 2, last_seen_at: null, open_tickets: 1, db_bytes: 2048 };
const detail = { ...row, updated_at: null, notes: '', suspended_reason: null, suspended_at: null, limits_override: {}, limits_effective: {}, feature_overrides: {}, features_effective: {}, owner: { id: 'o', phone: '919876543210', disabled: 0, created_at: '2026-01-01T00:00:00Z' }, devices: [], live: { staff_sockets: 0, device_sockets: 0 }, storage: { db_bytes: 2048, db_file: 'abc.db', uploads_bytes: 0, uploads_count: 0 }, database: { schema_version: 3, error: null }, counts: {}, activity: {}, settings: {}, tickets: { total: 1, open: 1 } } as unknown as Detail;

beforeEach(() => {
  jest.clearAllMocks();
  (listRestaurants as jest.Mock).mockResolvedValue([row]); (rootConfig as jest.Mock).mockResolvedValue(config); (getRestaurant as jest.Mock).mockResolvedValue(detail);
  (getFeatureAdmin as jest.Mock).mockResolvedValue({ features: [], switches: [] });
});
const renderTab = (openId: string | null = null) => render(<RestaurantsTab openId={openId} onOpenId={jest.fn()} onViewTickets={jest.fn()} />);

test('lists restaurants and filters by text', async () => {
  renderTab();
  expect(await screen.findByText('Test Diner')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search restaurants'), { target: { value: 'zzz' } });
  expect(screen.getByText('No restaurants match.')).toBeInTheDocument();
});

test('creating shows the generated owner password and PIN once, and refreshes the list', async () => {
  (createRestaurant as jest.Mock).mockResolvedValue({ id: 'n', name: 'Second', owner_phone: '919123456780', temp_owner_password: 'Gen3rated9', admin_pin: '4729' });
  renderTab();
  await screen.findByText('Test Diner');
  fireEvent.click(screen.getByRole('button', { name: '+ New restaurant' }));
  const create = screen.getByRole('button', { name: 'Create restaurant' });
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Restaurant name'), { target: { value: 'Second' } });
  fireEvent.change(screen.getByLabelText('Owner phone'), { target: { value: '9123456780' } });
  fireEvent.click(create);
  expect(await screen.findByText('Gen3rated9')).toBeInTheDocument();
  expect(screen.getByText('4729')).toBeInTheDocument();
  await waitFor(() => expect(listRestaurants).toHaveBeenCalledTimes(2));
});

test('deleting needs the exact name AND the root password', async () => {
  (deleteRestaurant as jest.Mock).mockResolvedValue({ success: true });
  renderTab('abc1234567');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete restaurant…' }));
  const go = await screen.findByRole('button', { name: 'Delete forever' });
  expect(go).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type the name to confirm/), { target: { value: 'Test Dine' } });
  fireEvent.change(screen.getByLabelText('Your root password'), { target: { value: 'pw' } });
  expect(go).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type the name to confirm/), { target: { value: 'Test Diner' } });
  fireEvent.click(go);
  await waitFor(() => expect(deleteRestaurant).toHaveBeenCalledWith('abc1234567', 'Test Diner', 'pw'));
});

test('a restaurant whose database cannot be read still opens, with dashes instead of numbers', async () => {
  (getRestaurant as jest.Mock).mockResolvedValue({ ...detail, database: { schema_version: null, error: 'disk I/O error' }, counts: {} });
  renderTab('abc1234567');
  expect(await screen.findByText('disk I/O error')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/undefined|NaN/);
});
