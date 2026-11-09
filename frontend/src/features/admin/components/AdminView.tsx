import { lazy, Suspense, useState } from 'react';
import TabBar from 'components/layout/TabBar';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';

const Floor = lazy(() => import('../floor/components/FloorView'));
const Restaurant = lazy(() => import('../restaurant/components/RestaurantPanel'));
const Tables = lazy(() => import('../tables/components/TablesPanel'));
const Menu = lazy(() => import('../menu/components/MenuSection'));
const Categories = lazy(() => import('../categories/components/CategoriesPanel'));
const Staff = lazy(() => import('../staff/components/StaffPanel'));
const Devices = lazy(() => import('../devices/components/DevicesPanel'));

const TABS = [
  { key: 'floor', label: 'Floor', feature: FEATURE.adminFloor, Component: Floor },
  { key: 'restaurant', label: 'Restaurant', feature: FEATURE.adminRestaurant, Component: Restaurant },
  { key: 'tables', label: 'Tables', feature: FEATURE.adminTables, Component: Tables },
  { key: 'menu', label: 'Menu Items', feature: FEATURE.adminMenu, Component: Menu },
  { key: 'categories', label: 'Categories', feature: FEATURE.adminCategories, Component: Categories },
  { key: 'staff', label: 'Staff', feature: FEATURE.adminStaff, Component: Staff },
  { key: 'devices', label: 'Devices', feature: FEATURE.adminDevices, Component: Devices },
];

export default function AdminView() {
  const { isOn } = useFeatures();
  const [tab, setTab] = useState<string>('floor');
  const tabs = TABS.filter(t => isOn(t.feature));
  const current = tabs.find(t => t.key === tab) ?? tabs[0];
  if (!current) return null;
  const { Component } = current;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabBar tabs={tabs} active={current.key} onSelect={setTab} label="Admin sections" />
      <div className={`flex-1 overflow-hidden ${current.key === 'floor' ? '' : 'overflow-y-auto p-5'}`}>
        <Suspense fallback={<PageSpinner />}><Component /></Suspense>
      </div>
    </div>
  );
}
