import { useCallback, useState } from 'react';
import { cashChange, isBigShortfall, paidAmount } from 'lib/reports/payment';
import { parseNumber } from 'lib/input/input';
import type { OrderType } from 'types/restaurant/orders';
import { PaymentForm } from '../payment-input';

interface Defaults { orderType: OrderType; customerName: string; customerPhone: string; /** Starting values that replace the defaults (used when editing an already-paid visit). */ initial?: Partial<PaymentForm> }

export function usePaymentForm(total: number, d: Defaults) {
  const [form, setForm] = useState<PaymentForm>(() => ({
    orderType: d.orderType, method: 'cash', received: total.toFixed(2),
    splits: [{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }],
    customerName: d.customerName, customerPhone: d.customerPhone, customerGstin: '',
    ...d.initial,
  }));
  const patch = useCallback(<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => setForm(f => ({ ...f, [key]: value })), []);

  const paid = paidAmount(form.method, form.received, form.splits, total);
  const change = form.method === 'cash' ? cashChange(parseNumber(form.received) ?? total, total) : 0;
  return { form, patch, paid, change, bigShortfall: isBigShortfall(total, paid) };
}
