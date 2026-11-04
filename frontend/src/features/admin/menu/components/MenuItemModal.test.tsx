import { fireEvent, render, screen } from '@testing-library/react';
import MenuItemModal from './MenuItemModal';
import type { Category, MenuItem } from 'types/restaurant/catalog';

const cats: Category[] = [{ id: 7, name: 'Starters', sort_order: 0 }];

test('a free item (price 0) can be saved and is sent as "0"', () => {
  const onSave = jest.fn();
  render(<MenuItemModal categories={cats} busy={false} onSave={onSave} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water' } });
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  const fd = onSave.mock.calls[0][0] as FormData;
  expect(fd.get('price')).toBe('0');
  expect(fd.get('category_id')).toBe('7');
});

test('invalid input shows a message and does not save', () => {
  const onSave = jest.fn();
  render(<MenuItemModal categories={cats} busy={false} onSave={onSave} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  expect(onSave).not.toHaveBeenCalled();
});

test('a saved photo can only be replaced: no Remove button, and a new pick can be discarded again', () => {
  const item: MenuItem = { id: 1, name: 'Wings', description: '', price: 5, category_id: 7, category_name: 'Starters', image_path: '/uploads/w.png', available: 1 };
  const onSave = jest.fn();
  render(<MenuItemModal item={item} categories={cats} busy={false} onSave={onSave} onClose={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Remove photo/ })).not.toBeInTheDocument();
  expect(screen.getByText(/cannot be removed, only replaced/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  const fd = onSave.mock.calls[0][0] as FormData;
  expect(fd.get('remove_image')).toBeNull();
  expect(fd.get('image')).toBeNull();
});
