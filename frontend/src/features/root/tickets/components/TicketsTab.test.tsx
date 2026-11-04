import { act, fireEvent, render, screen } from '@testing-library/react';
import { listTickets } from 'api/platform/root.api';
import TicketsTab from './TicketsTab';

jest.mock('api/platform/root.api', () => ({ listTickets: jest.fn(), getTicket: jest.fn(), updateTicket: jest.fn(), ticketScreenshotUrl: (id: number) => `/s/${id}` }));
const mockList = listTickets as jest.Mock;
beforeEach(() => { jest.useFakeTimers(); mockList.mockReset(); mockList.mockResolvedValue([]); });
afterEach(() => jest.useRealTimers());

test('typing in the search box sends ONE request after a pause, not one per key', async () => {
  render(<TicketsTab restaurantId="" onClearRestaurant={jest.fn()} onOpenRestaurant={jest.fn()} />);
  await act(async () => { jest.advanceTimersByTime(400); });
  mockList.mockClear();
  const box = screen.getByLabelText('Search tickets');
  for (const v of ['p', 'pr', 'pri', 'prin', 'print']) fireEvent.change(box, { target: { value: v } });
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(mockList).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockList.mock.calls[0][0]).toMatchObject({ q: 'print', status: 'active' });
});

test('the restaurant filter is sent and can be cleared', async () => {
  const clear = jest.fn();
  render(<TicketsTab restaurantId="abc123" onClearRestaurant={clear} onOpenRestaurant={jest.fn()} />);
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(mockList.mock.calls[0][0]).toMatchObject({ restaurant: 'abc123' });
  fireEvent.click(screen.getByRole('button', { name: /Restaurant filter/ }));
  expect(clear).toHaveBeenCalled();
});
