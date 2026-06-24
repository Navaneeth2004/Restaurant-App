import React, { useState } from 'react';
import AdminRestaurant  from './admin/AdminRestaurant';
import AdminTables      from './admin/AdminTables';
import AdminMenu        from './admin/AdminMenu';
import MenuExportImport from './admin/MenuExportImport';
import AdminCategories  from './admin/AdminCategories';
import AdminStaff       from './admin/AdminStaff';
import AdminFloor       from './admin/AdminFloor';

const TABS = [
  { key: 'floor',      label: 'Floor'       },
  { key: 'restaurant', label: 'Restaurant'  },
  { key: 'tables',     label: 'Tables'      },
  { key: 'menu',       label: 'Menu Items'  },
  { key: 'categories', label: 'Categories'  },
  { key: 'staff',      label: 'Staff'       },
] as const;

type AdminTab = typeof TABS[number]['key'];

export default function AdminView() {
  const [tab, setTab] = useState<AdminTab>('floor');

  const content: Record<AdminTab, React.ReactNode> = {
    floor:      <AdminFloor />,
    restaurant: <AdminRestaurant />,
    tables:     <AdminTables />,
    menu: (
      <div className="space-y-6">
        <AdminMenu />
        <MenuExportImport />
      </div>
    ),
    categories: <AdminCategories />,
    staff:      <AdminStaff />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex border-b border-surface-border bg-surface-card/50 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === t.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-zinc-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={`flex-1 overflow-hidden ${tab === 'floor' ? '' : 'overflow-y-auto p-5'}`}>
        {content[tab]}
      </div>
    </div>
  );
}