import { useContext } from 'react';
import { ToastContext, ToastFn } from './toast-context';

export const useToast = (): ToastFn => useContext(ToastContext);
