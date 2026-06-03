import axios from 'axios';
import type { Settings, Category, MenuItem, Table, Order, Staff, ReportSummary, RevenueDay, AuthUser } from '../types';

const ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;
const BASE = ORIGIN + '/api';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

api.interceptors.request.use(req => { console.log('[API]', req.method?.toUpperCase(), req.url); return req; });
api.interceptors.response.use(res => res, err => { console.error('[API Error]', err.response?.status, err.response?.data || err.message); return Promise.reject(err); });

export const API_ORIGIN = ORIGIN;

export const getSettings       = (): Promise<Settings>    => api.get('/settings').then(r => r.data);
export const updateSettings    = (data: Partial<Settings>): Promise<void> => api.put('/settings', data).then(r => r.data);
export const uploadLogo        = (file: File): Promise<{ logo_url: string }> => {
  const fd = new FormData(); fd.append('logo', file);
  return api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const getCategories     = (): Promise<Category[]>  => api.get('/categories').then(r => r.data);
export const createCategory    = (name: string): Promise<Category> => api.post('/categories', { name }).then(r => r.data);
export const updateCategory    = (id: number, data: Partial<Category>): Promise<void> => api.put(`/categories/${id}`, data).then(r => r.data);
export const deleteCategory    = (id: number): Promise<void> => api.delete(`/categories/${id}`).then(r => r.data);

export const getMenuItems      = (): Promise<MenuItem[]>  => api.get('/menu').then(r => r.data);
export const createMenuItem    = (fd: FormData): Promise<MenuItem> => api.post('/menu', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const updateMenuItem    = (id: number, fd: FormData): Promise<MenuItem> => api.put(`/menu/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const deleteMenuItem    = (id: number): Promise<void> => api.delete(`/menu/${id}`).then(r => r.data);

export const getTables         = (): Promise<Table[]>     => api.get('/tables').then(r => r.data);
export const createTable       = (data: { label: string; seats: number }): Promise<Table> => api.post('/tables', data).then(r => r.data);
export const updateTable       = (id: string, data: Partial<Table>): Promise<Table> => api.put(`/tables/${id}`, data).then(r => r.data);
export const deleteTable       = (id: string): Promise<void> => api.delete(`/tables/${id}`).then(r => r.data);

export const getActiveOrders   = (): Promise<Order[]>     => api.get('/orders/active').then(r => r.data);
export const getTableOrder     = (tableId: string): Promise<Order | null> => api.get(`/orders/table/${tableId}`).then(r => r.data);
// Returns ALL non-closed orders for a table — used for billing across multiple rounds
export const getTableOrders    = (tableId: string): Promise<Order[]> => api.get(`/orders/table/${tableId}/all`).then(r => r.data);
export const getOrderHistory   = (params?: Record<string, string>): Promise<Order[]> => api.get('/orders/history', { params }).then(r => r.data);
export const submitOrder       = (data: { table_id: string; items: any[] }): Promise<Order> => api.post('/orders', data).then(r => r.data);
export const deliverOrder      = (id: string): Promise<Order> => api.patch(`/orders/${id}/deliver`).then(r => r.data);
export const closeOrder        = (id: string): Promise<void> => api.patch(`/orders/${id}/close`).then(r => r.data);

export const getStaff          = (): Promise<Staff[]>     => api.get('/staff').then(r => r.data);
export const createStaff       = (data: { name: string; pin: string; role: string }): Promise<Staff> => api.post('/staff', data).then(r => r.data);
export const deleteStaff       = (id: number): Promise<void> => api.delete(`/staff/${id}`).then(r => r.data);
export const verifyPin         = (pin: string): Promise<AuthUser> => api.post('/staff/verify', { pin }).then(r => r.data);

export const getReportToday    = (): Promise<ReportSummary> => api.get('/reports/today').then(r => r.data);
export const getReportHistory  = (params?: Record<string, string>): Promise<Order[]> => api.get('/reports/history', { params }).then(r => r.data);
export const getRevenueChart   = (): Promise<RevenueDay[]> => api.get('/reports/revenue').then(r => r.data);

export const reorderTables = (order: { id: string; sort_order: number }[]): Promise<void> =>
  api.patch('/tables/reorder', { order }).then(r => r.data);

export const importMenu = (data: any): Promise<{ success: boolean; categories_added: number; items_added: number; items_skipped: number }> =>
  api.post('/export/menu/import', data).then(r => r.data);
