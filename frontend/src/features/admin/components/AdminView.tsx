import { lazy, Suspense, useState } from 'react';
import TabBar from 'components/layout/TabBar';
import PageSpinner from 'components/ui/feedback/PageSpinner';

const Floor = lazy(() => import('../floor/components/FloorView'));
const Restaurant = lazy(() => import('../restaurant/components/RestaurantPanel'));
const Tables = lazy(() => import('../tables/components/TablesPanel'));
const Menu = lazy(() => import('../menu/components/MenuSection'));
const Categories = lazy(() => import('../categories/components/CategoriesPanel'));
const Staff = lazy(() => import('../staff/components/StaffPanel'));
const Devices = lazy(() => import('../devices/components/DevicesPanel'));

const TABS = [
  { key: 'floor', label: 'Floor', Component: Floor }, { key: 'restaurant', label: 'Restaurant', Component: Restaurant },
  { key: 'tables', label: 'Tables', Component: Tables }, { key: 'menu', label: 'Menu Items', Component: Menu },
  { key: 'categories', label: 'Categories', Component: Categories }, { key: 'staff', label: 'Staff', Component: Staff },
  { key: 'devices', label: 'Devices', Component: Devices },
];

export default function AdminView() {
  const [tab, setTab] = useState<string>('floor');
  const current = TABS.find(t => t.key === tab) ?? TABS[0];
  const { Component } = current;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabBar tabs={TABS} active={current.key} onSelect={setTab} label="Admin sections" />
      <div className={`flex-1 overflow-hidden ${current.key === 'floor' ? '' : 'overflow-y-auto p-5'}`}>
        <Suspense fallback={<PageSpinner />}><Component /></Suspense>
      </div>
    </div>
  );
}
