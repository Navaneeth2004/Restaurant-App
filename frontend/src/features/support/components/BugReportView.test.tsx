import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from 'api/errors';
import { submitBugReport } from 'api/office/support.api';
import BugReportView from './BugReportView';

jest.mock('api/office/support.api', () => ({ submitBugReport: jest.fn() }));
jest.mock('state/nav/previous-view', () => ({ usePreviousView: () => 'waiter' }));
jest.mock('state/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 7, name: 'Wally', role: 'waiter' } }) }));
const mockSubmit = submitBugReport as jest.Mock;
beforeEach(() => { mockSubmit.mockReset(); mockSubmit.mockResolvedValue({ success: true, ticket_id: 12 }); });

const fill = () => {
  fireEvent.click(screen.getByRole('radio', { name: 'Billing & Payment' }));
  fireEvent.change(screen.getByLabelText(/Bug title/), { target: { value: ' Bill wrong ' } });
  fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'Total off by 1' } });
};

test('send stays disabled until category, title and description are filled', () => {
  render(<BugReportView />);
  const send = screen.getByRole('button', { name: 'Send Bug Report' });
  expect(send).toBeDisabled();
  fill();
  expect(send).toBeEnabled();
});

test('the ticket reports the screen the person came FROM, with fresh diagnostics and trimmed text', async () => {
  render(<BugReportView />);
  fill();
  fireEvent.change(screen.getByLabelText('Next step'), { target: { value: 'Open table 3' } });
  fireEvent.keyDown(screen.getByLabelText('Next step'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('radio', { name: /Critical/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Send Bug Report' }));
  expect(await screen.findByText('Ticket sent!')).toBeInTheDocument();
  expect(screen.getByText(/#12/)).toBeInTheDocument();
  const body = mockSubmit.mock.calls[0][0];
  expect(body).toMatchObject({ title: 'Bill wrong', description: 'Total off by 1', category: 'billing', severity: 'critical', steps: ['Open table 3'], screenshot: null });
  expect(body.diagnostics.appContext).toMatchObject({ currentView: 'waiter', userRole: 'waiter', userName: 'Wally' });
});

test('a server error (for example the hourly limit) is shown and the form is kept', async () => {
  mockSubmit.mockRejectedValue(new ApiError(429, 'You have sent several reports in the last hour. Please wait a little.'));
  render(<BugReportView />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Send Bug Report' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/last hour/);
  expect(screen.getByLabelText(/Bug title/)).toHaveValue(' Bill wrong ');
});

test('after sending, "Report another issue" gives a clean form', async () => {
  render(<BugReportView />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Send Bug Report' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Report another issue' }));
  await waitFor(() => expect(screen.getByLabelText(/Bug title/)).toHaveValue(''));
});

test('tickets are read in the root console: no "past tickets" panel here, for any role', () => {
  render(<BugReportView />);
  expect(screen.queryByText(/Past Tickets/i)).not.toBeInTheDocument();
});
