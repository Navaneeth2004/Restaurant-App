import { request, requestBlob } from '../http';
import { tzOffsetMin } from 'lib/format/local-time';
import type { Gstr1Preview, Gstr3b, Gstr9, MenuImportResult, RevenueReport } from 'types/office/export';

export interface Range { from: string; to: string }
const q = (r: Range) => ({ from: r.from, to: r.to, tz_offset_min: tzOffsetMin() });

export const gstr1Preview = (r: Range, signal?: AbortSignal) => request<Gstr1Preview>('/export/gst/gstr1/preview', { query: q(r), signal });
export const gstr1Download = (r: Range) => requestBlob('/export/gst/gstr1', { query: q(r) });
export const gstr3b = (r: Range, signal?: AbortSignal) => request<Gstr3b>('/export/gst/gstr3b', { query: q(r), signal });
export const gstr9 = (fy: string, signal?: AbortSignal) =>
  request<Gstr9>('/export/gst/gstr9', { query: { fy, tz_offset_min: tzOffsetMin() }, signal });

export const revenueReport = (r: Range, signal?: AbortSignal) => request<RevenueReport>('/export/revenue', { query: q(r), signal });

export const exportMenu = () => requestBlob('/export/menu');
export const importMenuZip = (file: File) => {
  const form = new FormData();
  form.append('menuzip', file);
  return request<MenuImportResult>('/export/menu/import', { method: 'POST', form });
};
export const importMenuJson = (data: unknown) => request<MenuImportResult>('/export/menu/import', { method: 'POST', json: data });
