import { lazy, Suspense, useState } from 'react';
import ViewHeader from 'components/layout/ViewHeader';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';

const Gstr1 = lazy(() => import('./gstr1/Gstr1Section'));
const Gstr3b = lazy(() => import('./gstr3b/Gstr3bSection'));
const Gstr9 = lazy(() => import('./gstr9/Gstr9Section'));
const Revenue = lazy(() => import('./revenue/RevenueSection'));

const TABS = [
  { key: 'gstr1', label: 'GSTR-1', feature: FEATURE.exportGstr1, Component: Gstr1 },
  { key: 'gstr3b', label: 'GSTR-3B', feature: FEATURE.exportGstr3b, Component: Gstr3b },
  { key: 'gstr9', label: 'GSTR-9', feature: FEATURE.exportGstr9, Component: Gstr9 },
  { key: 'revenue', label: 'Revenue', feature: FEATURE.exportRevenue, Component: Revenue },
];

export default function ExportView() {
  const { isOn } = useFeatures();
  const [tab, setTab] = useState('gstr1');
  const tabs = TABS.filter(t => isOn(t.feature));
  const current = tabs.find(t => t.key === tab) ?? tabs[0];
  if (!current) return null;
  const { Component } = current;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader title="Export" tabs={tabs} active={current.key} onSelect={setTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Suspense fallback={<PageSpinner />}><Component /></Suspense></div>
    </div>
  );
}
