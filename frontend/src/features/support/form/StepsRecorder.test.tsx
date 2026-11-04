import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import StepsRecorder from './StepsRecorder';

const Host = ({ initial = [] as string[] }) => { const [s, set] = useState(initial); return <StepsRecorder steps={s} onChange={set} />; };

test('Enter adds a trimmed step, blank adds nothing, remove works', () => {
  render(<Host />);
  const input = screen.getByLabelText('Next step');
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.queryByText('1')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: ' tap table ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('tap table')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));
  expect(screen.queryByText('tap table')).not.toBeInTheDocument();
});

test('at the server limit of 30 steps adding stops and says why', () => {
  render(<Host initial={Array.from({ length: 30 }, (_, i) => `s${i}`)} />);
  expect(screen.getByLabelText('Next step')).toBeDisabled();
  expect(screen.getByText(/most steps a ticket can hold/)).toBeInTheDocument();
});
