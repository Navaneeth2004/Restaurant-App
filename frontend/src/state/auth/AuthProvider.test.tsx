import { act, render, screen, waitFor } from '@testing-library/react';
import { WINDOW_EVENTS } from 'config/events';
import AuthProvider from './AuthProvider';
import { useAuth } from './useAuth';

const mockValidate = jest.fn();
const mockLogout = jest.fn();
const mockJoin = jest.fn();
const mockLeave = jest.fn();

jest.mock('api/access/staff.api', () => ({
  validateSession: (...a: unknown[]) => mockValidate(...a),
  logoutStaff: (...a: unknown[]) => mockLogout(...a),
}));
jest.mock('realtime/socket', () => ({
  joinStaffRoom: (...a: unknown[]) => mockJoin(...a),
  leaveStaffRoom: () => mockLeave(),
}));
jest.mock('realtime/useRefetchOnReconnect', () => ({ useRefetchOnReconnect: () => undefined }));

function Probe() {
  const { user, sessionEnded, sessionEndReason, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.name ?? 'none'}</span>
      <span data-testid="ended">{String(sessionEnded)}</span>
      <span data-testid="reason">{sessionEndReason ?? 'none'}</span>
      <button onClick={() => login({ id: 1, name: 'Ali', role: 'waiter' }, 'tok')}>login</button>
      <button onClick={() => { void logout(); }}>logout</button>
    </div>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  mockValidate.mockReset().mockResolvedValue({ valid: true });
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockJoin.mockReset().mockResolvedValue(true);
  mockLeave.mockReset();
});

test('login stores the session and joins the staff room; logout clears it', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => screen.getByText('login').click());
  expect(screen.getByTestId('user').textContent).toBe('Ali');
  expect(mockJoin).toHaveBeenCalledWith(1, 'tok');
  expect(sessionStorage.getItem('pos_session_token')).toBe('tok');
  await act(async () => { screen.getByText('logout').click(); });
  expect(screen.getByTestId('user').textContent).toBe('none');
  expect(sessionStorage.getItem('pos_session_token')).toBeNull();
  expect(mockLogout).toHaveBeenCalledWith(1, 'tok');
  expect(screen.getByTestId('ended').textContent).toBe('false');
});

test('a stored session the server rejects ends with sessionEnded=true', async () => {
  sessionStorage.setItem('pos_user', JSON.stringify({ id: 1, name: 'Ali', role: 'waiter' }));
  sessionStorage.setItem('pos_session_token', 'old');
  mockValidate.mockResolvedValue({ valid: false });
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('ended').textContent).toBe('true'));
  expect(screen.getByTestId('user').textContent).toBe('none');
});

test('a valid stored session is restored', async () => {
  sessionStorage.setItem('pos_user', JSON.stringify({ id: 1, name: 'Ali', role: 'waiter' }));
  sessionStorage.setItem('pos_session_token', 'good');
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Ali'));
  expect(mockJoin).toHaveBeenCalledWith(1, 'good');
});

test('staff_required from any request signs the user out', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => screen.getByText('login').click());
  act(() => { window.dispatchEvent(new Event(WINDOW_EVENTS.staffRequired)); });
  expect(screen.getByTestId('user').textContent).toBe('none');
  expect(screen.getByTestId('ended').textContent).toBe('true');
  expect(mockLeave).toHaveBeenCalled();
});

test('heartbeat runs only while signed in and stops on unmount', () => {
  jest.useFakeTimers();
  const { unmount } = render(<AuthProvider><Probe /></AuthProvider>);
  expect(jest.getTimerCount()).toBe(0);
  act(() => screen.getByText('login').click());
  expect(jest.getTimerCount()).toBeGreaterThan(0);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

test('heartbeat reporting an invalid session ends it', async () => {
  jest.useFakeTimers();
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => screen.getByText('login').click());
  mockValidate.mockResolvedValue({ valid: false });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(screen.getByTestId('user').textContent).toBe('none');
  expect(screen.getByTestId('ended').textContent).toBe('true');
  jest.useRealTimers();
});

test('a rejected session older than 7 days is reported as expired, a recent one as other', async () => {
  const store = (startedAt: number) => {
    sessionStorage.setItem('pos_user', JSON.stringify({ id: 1, name: 'Ali', role: 'waiter' }));
    sessionStorage.setItem('pos_session_token', 'old');
    sessionStorage.setItem('pos_session_started_at', String(startedAt));
  };
  mockValidate.mockResolvedValue({ valid: false });
  store(Date.now() - 8 * 86_400_000);
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('reason').textContent).toBe('expired'));
  view.unmount();
  sessionStorage.clear();
  store(Date.now() - 3600_000);
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('reason').textContent).toBe('other'));
});
