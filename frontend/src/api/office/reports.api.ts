import { request } from '../http';
import { tzOffsetMin } from 'lib/format/local-time';
import type { Order } from 'types/restaurant/orders';
import type { ReportSummary, RevenueDay } from 'types/office/reports';

const tz = () => ({ tz_offset_min: tzOffsetMin() });

export const getReportToday = (signal?: AbortSignal) => request<ReportSummary>('/reports/today', { query: tz(), signal });
export const getRevenueChart = (signal?: AbortSignal) => request<RevenueDay[]>('/reports/revenue', { query: tz(), signal });
/** The server caps history at 200 order rows unless `limit` is sent (its maximum is 1000). */
export const getReportHistory = (range: { from: string; to: string }, signal?: AbortSignal, limit?: number) =>
  request<Order[]>('/reports/history', { query: { ...tz(), from: range.from, to: range.to, limit }, signal });
