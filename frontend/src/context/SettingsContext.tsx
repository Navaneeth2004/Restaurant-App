import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../services/api';
import { getSocket } from '../services/socket';
import type { Settings } from '../types';

const defaults: Settings = {
  restaurant_name: 'ABC Chicken',
  brand_color: '#f97316',
  currency_symbol: '₹',
  tax_percent: '5',
  address: '',
  phone: '',
  bill_footer: 'Thank you for dining with us!',
};

const SettingsContext = createContext<Settings>(defaults);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    getSettings()
      .then(s => { setSettings(s); applyBrandColor(s.brand_color); })
      .catch(() => {});

    const socket = getSocket();
    const handler = (data: Partial<Settings>) => {
      setSettings(prev => ({ ...prev, ...data }));
      if (data.brand_color) applyBrandColor(data.brand_color);
    };
    socket.on('settings_updated', handler);
    return () => { socket.off('settings_updated', handler); };
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

function applyBrandColor(hex: string) {
  const r = document.documentElement;
  r.style.setProperty('--brand', hex);
}

export function useSettings() { return useContext(SettingsContext); }
