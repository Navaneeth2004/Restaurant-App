import { useState } from 'react';
import ThemeToggle from 'components/ui/base/ThemeToggle';
import AuditTab from '../audit/AuditTab';
import SubscriptionsTab from '../access/components/SubscriptionsTab';
import SwitchesTab from '../access/components/SwitchesTab';
import OverviewTab from '../overview/OverviewTab';
import RestaurantsTab from '../restaurants/components/RestaurantsTab';
import TicketsTab from '../tickets/components/TicketsTab';

type Tab = 'overview' | 'restaurants' | 'subscriptions' | 'switches' | 'tickets' | 'audit';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'restaurants', label: 'Restaurants' }, { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'switches', label: 'Screen switches' }, { key: 'tickets', label: 'Tickets' }, { key: 'audit', label: 'Audit log' },
];

export default function RootShell({ phone, onLogout }: { phone: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [openRestaurant, setOpenRestaurant] = useState<string | null>(null);
  const [ticketRestaurant, setTicketRestaurant] = useState('');
  const openRestaurantTab = (id: string | null): void => { setOpenRestaurant(id); if (id) setTab('restaurants'); };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-display font-bold text-white text-sm">Root console</span>
          <nav aria-label="Root sections" className="flex items-center gap-1 overflow-x-auto no-scrollbar ml-2">
            {TABS.map(t => <button key={t.key} type="button" aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border whitespace-nowrap transition-all ${tab === t.key ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'text-zinc-400 hover:text-white border-transparent'}`}>{t.label}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-500 text-xs hidden sm:block">{phone}</span><ThemeToggle />
            <button type="button" onClick={onLogout} className="text-xs text-zinc-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-raised">Log out</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {tab === 'overview' && <OverviewTab onOpen={openRestaurantTab} onTickets={() => { setTicketRestaurant(''); setTab('tickets'); }} />}
        {tab === 'restaurants' && <RestaurantsTab openId={openRestaurant} onOpenId={setOpenRestaurant} onViewTickets={id => { setTicketRestaurant(id); setTab('tickets'); }} />}
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'switches' && <SwitchesTab />}
        {tab === 'tickets' && <TicketsTab restaurantId={ticketRestaurant} onClearRestaurant={() => setTicketRestaurant('')} onOpenRestaurant={openRestaurantTab} />}
        {tab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
}
