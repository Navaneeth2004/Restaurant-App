import { fireEvent, render, screen } from '@testing-library/react';
import { useSortable } from './useSortable';

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'one' }, { id: '2', name: 'two' }, { id: '3', name: 'three' }];
const getId = (r: Row): string => r.id;

function List({ onReorder }: { onReorder: (next: Row[]) => void }) {
  const { getItemProps } = useSortable({ items: rows, getId, onReorder });
  return <ul>{rows.map(r => <li key={r.id} data-testid={r.name} {...getItemProps(r.id)}>{r.name}</li>)}</ul>;
}

test('dropping a numeric-looking string id reorders (the old id-parsing bug dropped it)', () => {
  const onReorder = jest.fn();
  render(<List onReorder={onReorder} />);
  const data = { setData: jest.fn(), effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(screen.getByTestId('one'), { dataTransfer: data });
  fireEvent.dragOver(screen.getByTestId('three'), { dataTransfer: data });
  fireEvent.drop(screen.getByTestId('three'), { dataTransfer: data });
  expect(onReorder).toHaveBeenCalledTimes(1);
  expect(onReorder.mock.calls[0][0].map(getId)).toEqual(['2', '3', '1']);
});

test('dropping on itself does nothing', () => {
  const onReorder = jest.fn();
  render(<List onReorder={onReorder} />);
  const data = { setData: jest.fn() };
  fireEvent.dragStart(screen.getByTestId('two'), { dataTransfer: data });
  fireEvent.drop(screen.getByTestId('two'), { dataTransfer: data });
  expect(onReorder).not.toHaveBeenCalled();
});
