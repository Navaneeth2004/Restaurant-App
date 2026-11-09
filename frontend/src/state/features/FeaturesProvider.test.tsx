import { act, render, screen } from '@testing-library/react';
import { EVENTS, WINDOW_EVENTS } from 'config/events';
import FeaturesProvider from './FeaturesProvider';
import { FEATURE } from './feature-keys';
import { useFeatures } from './useFeatures';

const mockGet = jest.fn();
const mockHandlers = new Map<string, () => void>();
jest.mock('api/access/features.api', () => ({ getFeatures: (...a: unknown[]) => mockGet(...a) }));
jest.mock('realtime/useSocketEvent', () => ({ useSocketEvent: (event: string, handler: () => void) => { mockHandlers.set(event, handler); } }));
jest.mock('realtime/useRefetchOnReconnect', () => ({ useRefetchOnReconnect: () => undefined }));

function Probe() {
  const f = useFeatures();
  return <p>{`gstr9 ${f.isOn(FEATURE.exportGstr9) ? 'on' : 'off'} · any ${f.anyOn([FEATURE.exportGstr9, FEATURE.exportGstr1]) ? 'on' : 'off'} · all ${f.anyOn([FEATURE.exportGstr9]) ? 'on' : 'off'}`}</p>;
}

beforeEach(() => { mockHandlers.clear(); mockGet.mockReset(); });

test('everything is on until the server lists a feature as off', async () => {
  mockGet.mockResolvedValue({ disabled: { 'export.gstr9': 'Not available' } });
  render(<FeaturesProvider><Probe /></FeaturesProvider>);
  expect(screen.getByText(/gstr9 on/)).toBeInTheDocument();
  expect(await screen.findByText('gstr9 off · any on · all off')).toBeInTheDocument();
});

test('a features_updated event from root re-reads the list', async () => {
  mockGet.mockResolvedValueOnce({ disabled: { 'export.gstr9': 'x' } }).mockResolvedValue({ disabled: {} });
  render(<FeaturesProvider><Probe /></FeaturesProvider>);
  await screen.findByText(/gstr9 off/);
  await act(async () => { mockHandlers.get(EVENTS.featuresUpdated)?.(); });
  expect(await screen.findByText(/gstr9 on/)).toBeInTheDocument();
});

test('a refused request (feature_disabled) re-reads the list too', async () => {
  mockGet.mockResolvedValueOnce({ disabled: {} }).mockResolvedValue({ disabled: { 'export.gstr9': 'x' } });
  render(<FeaturesProvider><Probe /></FeaturesProvider>);
  await screen.findByText(/gstr9 on/);
  await act(async () => { window.dispatchEvent(new Event(WINDOW_EVENTS.featureDisabled)); });
  expect(await screen.findByText(/gstr9 off/)).toBeInTheDocument();
});
