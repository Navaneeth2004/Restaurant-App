 import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

test('shows the title and hint, and an icon tile only when an icon is given', () => {
  const { container, rerender } = render(<EmptyState title="Nothing here" hint="Come back later" />);
  expect(screen.getByText('Nothing here')).toBeInTheDocument();
  expect(screen.getByText('Come back later')).toBeInTheDocument();
  expect(container.querySelector('svg')).toBeNull();
  rerender(<EmptyState title="Nothing has been deleted" icon="trash" />);
  expect(container.querySelector('svg')).not.toBeNull();
});
