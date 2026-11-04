import { useContext } from 'react';
import { AdminLockContext, AdminLockValue } from './lock-context';

export const useAdminLock = (): AdminLockValue => useContext(AdminLockContext);
