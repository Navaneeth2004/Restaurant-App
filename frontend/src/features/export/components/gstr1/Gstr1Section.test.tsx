import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { gstr1Download, gstr1Preview } from 'api/office/export.api';
import { downloadBlob } from 'lib/browser/download';
import type { Gstr1Preview } from 'types/office/export';
import Gstr1Section from './Gstr1Section';

jest.mock('api/office/export.api', () => ({ gstr1Preview: jest.fn(), gstr1Download: jest.fn() }));
jest.mock('lib/browser/download', () => ({ downloadBlob: jest.fn() }));
const preview = gstr1Preview as jest.Mock;

const data: Gstr1Preview = {
  period: { from: 'a', to: 'b' }, return_period: '052026', gstin: '32ABCDE1234F1Z5', legal_name: 'Diner', state_name: 'Kerala', state_code: '32',
  sac_code: '9963', tax_rate: 5, order_count: 3, item_qty: 7,
  b2cs: { invoice_count: 2, taxable_value: 100, central_tax: 2.5, state_ut_tax: 2.5 },
  b2b: { invoice_count: 1, gstin_count: 1, taxable_value: 50, central_tax: 1.25, state_ut_tax: 1.25 },
  totals: { taxable_value: 150, central_tax: 3.75, state_ut_tax: 3.75, total_tax: 7.5, total_incl_tax: 157.5 },
  hsn_summary: [{ hsn_sc: '9963', desc: 'Restaurant Services', uqc: 'OTH', qty: 7, taxable: 150, central_tax: 3.75, state_ut_tax: 3.75 }], doc_issued: 3,
};
beforeEach(() => { preview.mockReset(); preview.mockResolvedValue(data); (gstr1Download as jest.Mock).mockResolvedValue(new Blob(['{}'])); (downloadBlob as jest.Mock).mockReset(); });

test('shows the server figures, with no "undefined" anywhere', async () => {
  render(<Gstr1Section />);
  expect(await screen.findByText('₹157.50')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/undefined|NaN/);
});

test('an inverted date range shows the error, sends no request and hides stale figures', async () => {
  render(<Gstr1Section />);
  await screen.findByText('₹157.50');
  preview.mockClear();
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2000-01-01' } });
  expect(await screen.findByRole('alert')).toHaveTextContent(/after/i);
  expect(preview).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /Download GSTR-1 JSON/ })).not.toBeInTheDocument();   // no figures for an invalid range, so nothing to download
});

test('download names the file with the period', async () => {
  render(<Gstr1Section />);
  fireEvent.click(await screen.findByRole('button', { name: /Download GSTR-1 JSON/ }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^GSTR1_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.json$/)));
});
