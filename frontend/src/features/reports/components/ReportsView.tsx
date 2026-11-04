import { lazy, Suspense, useState } from 'react';
import ViewHeader from 'components/layout/ViewHeader';
import PageSpinner from 'components/ui/feedback/PageSpinner';

const Analytics = lazy(() => import('../analytics/components/AnalyticsTab'));
const History = lazy(() => import('../history/components/HistoryTab'));
const Deleted = lazy(() => import('../deleted/components/DeletedTab'));

const TABS = [
  { key: 'analytics', label: 'Analytics', Component: Analytics },
  { key: 'history', label: 'History', Component: History },
  { key: 'deleted', label: 'Deleted', Component: Deleted },
];

export default function ReportsView() {
  const [tab, setTab] = useState('analytics');
  const { Component } = TABS.find(t => t.key === tab) ?? TABS[0];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader title="Reports" tabs={TABS} active={tab} onSelect={setTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5"><Suspense fallback={<PageSpinner />}><Component /></Suspense></div>
    </div>
  );
}
