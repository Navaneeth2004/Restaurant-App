export interface Category { id: number; name: string; sort_order: number }
export interface MenuItem {
  id: number; name: string; description: string; price: number;
  category_id: number; category_name: string; image_path: string | null;
  available: number; // 0 | 1 (SQLite)
}
export interface ReorderEntry { id: number | string; sort_order: number }
