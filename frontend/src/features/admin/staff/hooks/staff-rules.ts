import type { Staff } from 'types/core/auth';

export const ROLE_STYLES = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/25',
  kitchen: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  waiter: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
} as const;

export const activeAdminCount = (staff: ReadonlyArray<Staff>): number => staff.filter(s => s.role === 'admin' && s.active).length;

/** The reason a member cannot be removed, or null if they can. The server enforces the same rules. */
export function deleteBlocker(s: Staff, currentUserId: number | undefined, staff: ReadonlyArray<Staff>): string | null {
  if (s.id === currentUserId) return "Can't delete your own account";
  if (s.role === 'admin' && s.active && activeAdminCount(staff) <= 1) return 'Cannot delete the last admin';
  return null;
}

/** null when the two PIN entries are acceptable to send (the server still refuses weak PINs). */
export function pinProblem(pin: string, confirm: string, min: number): string | null {
  if (pin.length < min) return `PIN must be at least ${min} digits.`;
  if (pin !== confirm) return 'PINs do not match.';
  return null;
}
