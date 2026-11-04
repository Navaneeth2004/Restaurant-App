import { createContext } from 'react';

export type ToastType = 'default' | 'success' | 'error' | 'info';
export type ToastFn = (message: string, type?: ToastType) => void;

export const ToastContext = createContext<ToastFn>(() => undefined);
