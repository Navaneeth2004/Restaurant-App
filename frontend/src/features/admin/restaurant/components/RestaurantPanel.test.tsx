import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getSubscription } from 'api/access/subscription.api';
import { updateSettings } from 'api/restaurant/settings.api';
import RestaurantPanel from './RestaurantPanel';

jest.mock('api/restaurant/settings.api', () => ({ updateSettings: jest.fn(), uploadLogo: jest.fn() }));
jest.mock('api/access/subscription.api', () => ({ getSubscription: jest.fn() }));
const mockUpdate = updateSettings as jest.Mock;

beforeEach(() => {
  mockUpdate.mockReset(); mockUpdate.mockResolvedValue(undefined);
  (getSubscription as jest.Mock).mockReturnValue(new Promise(() => undefined));
});

test('Save is disabled until something changes, and re-disables after saving', async () => {
  render(<RestaurantPanel />);
  const save = screen.getByRole('button', { name: 'Save Settings' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Restaurant Name'), { target: { value: 'New Name' } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate.mock.calls[0][0]).toMatchObject({ restaurant_name: 'New Name' });
  expect(Object.keys(mockUpdate.mock.calls[0][0])).not.toContain('admin_lock_config');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled());
});

test('a typed tax of 1000000 is clamped to 100 and a bad colour blocks saving', () => {
  render(<RestaurantPanel />);
  fireEvent.change(screen.getByLabelText('Tax % (GST)'), { target: { value: '1000000' } });
  expect(screen.getByLabelText('Tax % (GST)')).toHaveValue(100);
  fireEvent.change(screen.getByLabelText('Colour code'), { target: { value: '#12' } });
  expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
});