import { fireEvent, render, screen } from '@testing-library/react';
import SubscriptionEditor from './SubscriptionEditor';

const features = [
  { key: 'reports.analytics', label: 'Analytics', group: 'Reports' }, { key: 'reports.history', label: 'History', group: 'Reports' },
  { key: 'kiosk', label: 'Customer QR ordering', group: 'Capabilities' },
];
const limitKeys = [{ key: 'max_staff', label: 'Max staff accounts' }];
const initial = { name: '', description: '', limits: { max_staff: '' }, disabled: [] as string[] };
const setup = (onSave = jest.fn()) => {
  render(<SubscriptionEditor title="New subscription" initial={initial} features={features} limitKeys={limitKeys} busy={false} onSave={onSave} onClose={jest.fn()} />);
  return onSave;
};

test('a name is required before anything is saved', () => {
  const onSave = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Save subscription' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/name/);
  expect(onSave).not.toHaveBeenCalled();
});

test('switching a whole group off and one feature off is saved as the list of switched-off features', () => {
  const onSave = setup();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Lite ' } });
  fireEvent.change(screen.getByLabelText('Max staff accounts'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('switch', { name: 'All of Reports' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Customer QR ordering' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save subscription' }));
  expect(onSave).toHaveBeenCalledWith({ name: 'Lite', description: '', limits: { max_staff: 5 }, disabled: ['reports.analytics', 'reports.history', 'kiosk'] });
});

test('the group switch turns a half-off group fully on, and a single feature can be switched back on', () => {
  const onSave = setup();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lite' } });
  fireEvent.click(screen.getByRole('switch', { name: 'History' }));            // History off -> group is "1 of 2 on"
  expect(screen.getByText('1 of 2 on')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'All of Reports' }));     // not all on -> turns everything on
  expect(screen.getAllByText('2 of 2 on').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save subscription' }));
  expect(onSave.mock.calls[0][0].disabled).toEqual([]);
});
