import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AmountTable from './AmountTable';

const mockToast = jest.fn();
jest.mock('state/toast/useToast', () => ({ useToast: () => mockToast }));

const rows = [{ label: 'Total Tax', value: 7.5 }, { label: 'Total Quantity', value: 7, kind: 'count' as const }];
beforeEach(() => mockToast.mockReset());

test('shows money with the symbol but copies the bare number', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<AmountTable title="T" rows={rows} sym="₹" />);
  expect(screen.getByText('₹7.50')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy Total Tax' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('7.50'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy Total Quantity' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('7'));
  expect(mockToast).toHaveBeenCalledWith('Copied: Total Tax', 'success');
});

test('a clipboard failure is reported, not swallowed', async () => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  render(<AmountTable title="T" rows={rows} sym="₹" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Total Tax' }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/Could not copy/), 'error'));
});

test('an empty table says so', () => {
  render(<AmountTable title="T" rows={[]} sym="₹" />);
  expect(screen.getByText('No figures for this period.')).toBeInTheDocument();
});
