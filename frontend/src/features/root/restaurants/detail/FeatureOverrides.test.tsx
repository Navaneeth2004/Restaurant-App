import { fireEvent, render, screen } from '@testing-library/react';
import { getFeatureAdmin } from 'api/platform/root.api';
import type { RestaurantDetail } from 'types/office/root';
import FeatureOverrides from './FeatureOverrides';

jest.mock('api/platform/root.api', () => ({ getFeatureAdmin: jest.fn() }));

const features = [{ key: 'export.gstr9', label: 'GSTR-9 annual return', group: 'Export' }, { key: 'kiosk', label: 'Customer QR ordering', group: 'Capabilities' }];
const detail = (over: Partial<RestaurantDetail> = {}) => ({
  plan: 'lite', feature_overrides: {}, features_effective: { 'export.gstr9': { on: false, source: 'plan' }, kiosk: { on: true, source: null } }, ...over,
}) as unknown as RestaurantDetail;

beforeEach(() => { (getFeatureAdmin as jest.Mock).mockResolvedValue({ features, switches: [] }); });

test('shows what each feature is now and why, and only forced features are saved', async () => {
  const onSave = jest.fn();
  render(<FeatureOverrides detail={detail()} busy={false} onSave={onSave} />);
  expect(await screen.findByText('GSTR-9 annual return')).toBeInTheDocument();
  expect(screen.getByText('off · subscription')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'On' })[0]);     // force GSTR-9 on for this restaurant
  fireEvent.click(screen.getAllByRole('button', { name: 'Off' })[1]);    // force QR ordering off
  fireEvent.click(screen.getByRole('button', { name: 'Save feature settings' }));
  expect(onSave).toHaveBeenCalledWith({ 'export.gstr9': true, kiosk: false });
});

test('existing overrides are shown selected and "Inherit" removes them from what is saved', async () => {
  const onSave = jest.fn();
  render(<FeatureOverrides detail={detail({ feature_overrides: { kiosk: false } })} busy={false} onSave={onSave} />);
  await screen.findByText('Customer QR ordering');
  const group = screen.getByRole('group', { name: 'Customer QR ordering setting' });
  expect(group.querySelector('[aria-pressed="true"]')).toHaveTextContent('Off');
  fireEvent.click(group.querySelectorAll('button')[0]);                  // Inherit
  fireEvent.click(screen.getByRole('button', { name: 'Save feature settings' }));
  expect(onSave).toHaveBeenCalledWith({});
});
