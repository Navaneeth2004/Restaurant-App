import { deleteBlocker, pinProblem } from './staff-rules';
import type { Staff } from 'types/core/auth';

const staff: Staff[] = [
  { id: 1, name: 'Owner', role: 'admin', active: 1 },
  { id: 2, name: 'Ali', role: 'waiter', active: 1 },
  { id: 3, name: 'Old', role: 'admin', active: 0 },
];

test('cannot delete yourself or the last active admin', () => {
  expect(deleteBlocker(staff[0], 1, staff)).toMatch(/own account/);
  expect(deleteBlocker(staff[0], 2, staff)).toMatch(/last admin/);
  expect(deleteBlocker(staff[1], 1, staff)).toBeNull();
  expect(deleteBlocker(staff[2], 1, staff)).toBeNull();
});
test('PIN entry problems', () => {
  expect(pinProblem('12', '12', 4)).toMatch(/at least 4/);
  expect(pinProblem('1234', '1235', 4)).toMatch(/do not match/);
  expect(pinProblem('1234', '1234', 4)).toBeNull();
});
