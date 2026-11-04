import { request } from '../http';
import type { Category, MenuItem, ReorderEntry } from 'types/restaurant/catalog';

export const listCategories = (signal?: AbortSignal) => request<Category[]>('/categories', { signal });
export const createCategory = (name: string) => request<Category>('/categories', { method: 'POST', json: { name } });
export const renameCategory = (id: number, name: string) => request<void>(`/categories/${id}`, { method: 'PUT', json: { name } });
export const deleteCategory = (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' });
export const reorderCategories = (order: ReorderEntry[]) => request<void>('/categories/reorder', { method: 'PATCH', json: { order } });

export const listMenu = (signal?: AbortSignal) => request<MenuItem[]>('/menu', { signal });
export const createMenuItem = (form: FormData) => request<MenuItem>('/menu', { method: 'POST', form });
export const updateMenuItem = (id: number, form: FormData) => request<MenuItem>(`/menu/${id}`, { method: 'PUT', form });
export const deleteMenuItem = (id: number) => request<void>(`/menu/${id}`, { method: 'DELETE' });
export const reorderMenu = (items: ReorderEntry[]) => request<void>('/menu/reorder', { method: 'PATCH', json: { items } });
