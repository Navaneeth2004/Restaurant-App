export interface PaymentMethodDef { key: string; label: string }

export const PAYMENT_METHODS: ReadonlyArray<PaymentMethodDef> = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'split', label: 'Split' },
];
export const SPLIT_METHODS = PAYMENT_METHODS.filter(m => m.key !== 'split');

/** A payment short of the bill by more than 5% OR more than 20 currency units needs a confirmation. */
export const SHORT_WARN_PCT = 0.05;
export const SHORT_WARN_ABS = 20;
