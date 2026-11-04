export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface MenuFormValues {
  name: string; description: string; price: string; categoryId: string; available: boolean;
  image: File | null;
}

/** null when valid, otherwise the message to show under the form. */
export function validateMenuForm(v: MenuFormValues): string | null {
  if (!v.name.trim()) return 'Please enter a name.';
  const price = Number(v.price);
  if (v.price.trim() === '' || !Number.isFinite(price) || price < 0) return 'Enter a valid price (0 or more).';
  if (!v.categoryId) return 'Choose a category.';
  if (v.image && v.image.size > MAX_IMAGE_BYTES) return 'The photo is larger than 5 MB.';
  return null;
}

/** Multipart body. The server keeps the existing photo unless a new file is sent (it has no way to remove one). */
export function buildMenuFormData(v: MenuFormValues): FormData {
  const fd = new FormData();
  fd.append('name', v.name.trim());
  fd.append('description', v.description.trim());
  fd.append('price', v.price.trim());
  fd.append('category_id', v.categoryId);
  fd.append('available', String(v.available));
  if (v.image) fd.append('image', v.image);
  return fd;
}
