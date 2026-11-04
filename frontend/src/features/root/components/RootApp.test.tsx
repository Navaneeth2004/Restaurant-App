import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from 'api/errors';
import { rootLogin, rootMe, rootOverview } from 'api/platform/root.api';
import RootApp from './RootApp';

jest.mock('api/platform/root.api', () => ({ rootMe: jest.fn(), rootLogin: jest.fn(), rootLogout: jest.fn().mockResolvedValue({}), rootOverview: jest.fn() }));
const overview = { restaurants: { total: 2, by_status: { active: 2 } }, owners: 2, devices: 3, tickets: { open: 1, critical_open: 0 }, connected_sockets: 4, trial_ending_soon: [], recent_tickets: [], recently_active: [], server: { node: 'v20', uptime_s: 3700, memory_mb: 90, deployment: 'cloud' } };
beforeEach(() => { jest.clearAllMocks(); (rootOverview as jest.Mock).mockResolvedValue(overview); });

test('signed out: shows the login, a wrong password shows the server text, a right one opens the console', async () => {
  (rootMe as jest.Mock).mockRejectedValue(new ApiError(401, 'Please log in.'));
  (rootLogin as jest.Mock).mockRejectedValueOnce(new ApiError(401, 'Incorrect phone number or password.')).mockResolvedValueOnce({ phone: '919999900000' });
  render(<RootApp />);
  fireEvent.change(await screen.findByLabelText('Phone number'), { target: { value: '9999900000' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect phone number or password.');
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rootpassword1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Restaurants')).toBeInTheDocument();
  expect(await screen.findByText('1h 1m')).toBeInTheDocument();     // 3700 s of server uptime
});

test('an existing session goes straight to the console and the tabs switch', async () => {
  (rootMe as jest.Mock).mockResolvedValue({ phone: '919999900000' });
  render(<RootApp />);
  expect(await screen.findByText('919999900000')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
});
