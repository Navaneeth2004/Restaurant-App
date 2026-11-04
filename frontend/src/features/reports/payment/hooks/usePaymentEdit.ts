import { useMemo, useState } from 'react';
import { updatePayment } from 'api/restaurant/orders.api';
import { usePaymentForm } from 'features/billing/hooks/usePaymentForm';
import type { PaymentForm } from 'features/billing/payment-input';
import { useToastAction } from 'hooks/async/useToastAction';
import type { Visit } from 'lib/orders/visits';
import { buildEditInput, gstinProblem, startIsValid, startParts } from './payment-edit';

const DEFAULT_SPLITS = [{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }];

function initialForm(v: Visit): Partial<PaymentForm> {
  return {
    method: v.paymentMethod ?? 'cash', received: v.amountPaid.toFixed(2),
    splits: v.split.length >= 2 ? v.split.map(s => ({ method: s.method, amount: String(s.amount) })) : DEFAULT_SPLITS,
    customerGstin: v.customerGstin ?? '',
  };
}

/** State and save for the "Edit payment" dialog of one closed visit. */
export function usePaymentEdit(visit: Visit, onSaved: () => void) {
  const initial = useMemo(() => initialForm(visit), [visit]);
  const pay = usePaymentForm(visit.total, { orderType: visit.orderType, customerName: '', customerPhone: '', initial });
  const [start, setStart] = useState(() => startParts(visit.startedAt));
  const { busy, run } = useToastAction();

  const gstinError = gstinProblem(pay.form.customerGstin, visit.customerGstin);
  const startValid = startIsValid(start.date, start.time);
  /** Only true when the saved GSTIN was blanked out: the server cannot remove it, so it stays. */
  const clearedGstin = !!visit.customerGstin && !pay.form.customerGstin.trim();

  const save = async (): Promise<void> => {
    const last = visit.orders[visit.orders.length - 1];
    const input = buildEditInput(pay.form, visit.total, { original: visit.startedAt, ...start });
    const ok = await run(() => updatePayment(last.id, input), { success: 'Payment updated', failure: 'Failed to update payment' });
    if (ok) onSaved();
  };
  return { pay, start, setStart, busy, save, gstinError, startValid, clearedGstin, canSave: !busy && !gstinError && startValid };
}
