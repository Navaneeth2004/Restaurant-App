import { useContext } from 'react';
import { AuthContext, AuthValue } from './auth-context';

export const useAuth = (): AuthValue => useContext(AuthContext);
