import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { downloadBackup, factoryReset, restoreBackup } from 'api/office/backup.api';
import { downloadBlob } from 'lib/browser/download';
import BackupView from './BackupView';

const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockToast = jest.fn();
jest.mock('api/office/backup.api', () => ({ downloadBackup: jest.fn(), restoreBackup: jest.fn(), factoryReset: jest.fn() }));
jest.mock('api/access/staff.api', () => ({ checkPin: jest.fn() }));
jest.mock('lib/browser/download', () => ({ downloadBlob: jest.fn() }));
jest.mock('state/auth/useAuth', () => ({ useAuth: () => ({ logout: mockLogout }) }));
jest.mock('state/toast/useToast', () => ({ useToast: () => mockToast }));
jest.mock('components/pin/PinModal', () => ({ __esModule: true, default: ({ subtitle, onSuccess }: { subtitle?: string; onSuccess: (p: string) => void }) => <div><p>{subtitle}</p><button onClick={() => onSuccess('4826')}>enter pin</button></div> }));

const zip = (name = 'b.zip', size = 10) => { const f = new File(['x'], name, { type: 'application/zip' }); Object.defineProperty(f, 'size', { value: size }); return f; };
beforeEach(() => { jest.clearAllMocks(); (downloadBackup as jest.Mock).mockResolvedValue(new Blob(['z'])); (restoreBackup as jest.Mock).mockResolvedValue({ success: true, message: 'Restored. 3 images restored. Everyone must log in again.' }); (factoryReset as jest.Mock).mockResolvedValue({ message: 'done' }); });

test('download saves a dated zip', async () => {
  render(<BackupView />);
  fireEvent.click(screen.getByRole('button', { name: /Download Backup/ }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^pos_backup_\d{4}-\d{2}-\d{2}\.zip$/)));
});

test('restore needs the PIN, uploads the file, shows the server message and signs out (a restore ends every session)', async () => {
  render(<BackupView />);
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [zip('mine.zip')] } });
  expect(await screen.findByText(/mine\.zip/)).toBeInTheDocument();
  expect(restoreBackup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'enter pin' }));
  await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  expect(restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ name: 'mine.zip' }));
  expect(mockToast).toHaveBeenCalledWith('Restored. 3 images restored. Everyone must log in again.', 'success');
});

test('a file above the server limit is refused before any PIN or upload', () => {
  render(<BackupView />);
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [zip('huge.zip', 61 * 1024 * 1024)] } });
  expect(screen.queryByRole('button', { name: 'enter pin' })).not.toBeInTheDocument();
  expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/60 MB/), 'error');
});

test('a failed restore does not sign anyone out', async () => {
  (restoreBackup as jest.Mock).mockRejectedValue(new Error('Invalid backup'));
  render(<BackupView />);
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [zip()] } });
  fireEvent.click(await screen.findByRole('button', { name: 'enter pin' }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error'));
  expect(mockLogout).not.toHaveBeenCalled();
});

test('factory reset is hidden until five taps, then needs three deliberate steps and the exact phrase', async () => {
  render(<BackupView />);
  expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
  const version = screen.getByText(/^v\d/);
  for (let i = 0; i < 5; i++) fireEvent.click(version);
  expect(await screen.findByText('Danger Zone')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Factory Reset…' }));   // lock disabled in tests: opens directly
  expect(await screen.findByText(/What gets deleted/)).toBeInTheDocument();
  expect(screen.getByText(/GST details/)).toBeInTheDocument();                // settings reset is disclosed
  fireEvent.click(screen.getByRole('button', { name: /I understand/ }));
  fireEvent.click(screen.getByRole('button', { name: /Yes, I have a backup/ }));
  const reset = screen.getByRole('button', { name: 'Reset Now' });
  expect(reset).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirmation phrase'), { target: { value: 'reset everything' } });
  expect(reset).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirmation phrase'), { target: { value: 'RESET EVERYTHING' } });
  fireEvent.click(reset);
  await waitFor(() => expect(factoryReset).toHaveBeenCalledTimes(1));
});
