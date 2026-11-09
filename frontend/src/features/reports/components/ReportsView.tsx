import { lazy, Suspense, useState } from 'react';
import ViewHeader from 'components/layout/ViewHeader';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';

const Analytics = lazy(() => import('../analytics/components/AnalyticsTab'));
const History = lazy(() => import('../history/components/HistoryTab'));
const Deleted = lazy(() => import('../deleted/components/DeletedTab'));

const TABS = [
  { key: 'analytics', label: 'Analytics', feature: FEATURE.reportsAnalytics, Component: Analytics },
  { key: 'history', label: 'History', feature: FEATURE.reportsHistory, Component: History },
  { key: 'deleted', label: 'Deleted', feature: FEATURE.reportsDeleted, Component: Deleted },
];

export default function ReportsView() {
  const { isOn } = useFeatures();
  const [tab, setTab] = useState('analytics');
  const tabs = TABS.filter(t => isOn(t.feature));
  const current = tabs.find(t => t.key === tab) ?? tabs[0];
  if (!current) return null;
  const { Component } = current;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader title="Reports" tabs={tabs} active={current.key} onSelect={setTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Suspense fallback={<PageSpinner />}><Component /></Suspense></div>
    </div>
  );
}
