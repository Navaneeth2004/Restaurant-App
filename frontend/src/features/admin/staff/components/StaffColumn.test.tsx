import { fireEvent, render, screen } from '@testing-library/react';
import StaffColumn from './StaffColumn';
import type { Staff } from 'types/core/auth';

const me: Staff = { id: 1, name: 'Owner', role: 'admin', active: 1 };
const other: Staff = { id: 2, name: 'Admin2', role: 'admin', active: 1 };

test('a blocked member has a disabled remove button with the reason', () => {
  const onDelete = jest.fn();
  render(<StaffColumn role="admin" members={[me, other]} blocker={s => (s.id === 1 ? "Can't delete your own account" : null)} onPin={jest.fn()} onDelete={onDelete} />);
  const mine = screen.getByRole('button', { name: 'Remove Owner' });
  expect(mine).toBeDisabled();
  expect(mine).toHaveAttribute('title', "Can't delete your own account");
  fireEvent.click(screen.getByRole('button', { name: 'Remove Admin2' }));
  expect(onDelete).toHaveBeenCalledWith(other);
});

test('an empty name does not crash the avatar', () => {
  render(<StaffColumn role="waiter" members={[{ id: 9, name: '', role: 'waiter', active: 1 }]} blocker={() => null} onPin={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Change PIN/ })).toBeInTheDocument();
});
