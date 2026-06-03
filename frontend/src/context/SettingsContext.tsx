import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../services/api';
import { getSocket } from '../services/socket';
import type { Settings } from '../types';

const defaults: Settings & { logo_url?: string } = {
  restaurant_name: 'ABC Chicken',
  brand_color: '#f97316',
  currency_symbol: '₹',
  tax_percent: '5',
  address: '',
  phone: '',
  bill_footer: 'Thank you for dining with us!',
};

const SettingsContext = createContext<Settings & { logo_url?: string }>(defaults);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings & { logo_url?: string }>(defaults);

  useEffect(() => {
    getSettings()
      .then(s => {
        const full = { ...defaults, ...s };
        setSettings(full);
        injectBrandColor(full.brand_color || '#f97316');
      })
      .catch(() => {});

    const socket = getSocket();
    const handler = (data: Partial<Settings & { logo_url?: string }>) => {
      setSettings(prev => {
        const next = { ...prev, ...data };
        if (data.brand_color) injectBrandColor(data.brand_color);
        return next;
      });
    };
    socket.on('settings_updated', handler);
    return () => { socket.off('settings_updated', handler); };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * FIX #1: Inject a <style> tag that overrides ALL brand color usages.
 * Tailwind compiles colors at build time so we can't change CSS vars alone —
 * we override every class that uses brand color directly via !important rules.
 */
function injectBrandColor(hex: string) {
  const dark   = shade(hex, -15);
  const medium = shade(hex, -8);
  const light  = hex + '26'; // 15% opacity
  const lighter = hex + '1a'; // 10% opacity
  const faint  = hex + '14'; // 8% opacity
  const border30 = hex + '4d';
  const border60 = hex + '99';
  const text   = shade(hex, 12); // slightly lighter for text

  let tag = document.getElementById('__brand_override') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = '__brand_override';
    document.head.appendChild(tag);
  }

  tag.textContent = `
    /* Backgrounds */
    .bg-brand-500, .hover\\:bg-brand-500:hover { background-color: ${hex} !important; }
    .bg-brand-600, .hover\\:bg-brand-600:hover { background-color: ${dark} !important; }
    .bg-brand-500\\/8,  .bg-brand-500\\/10 { background-color: ${faint} !important; }
    .bg-brand-500\\/15, .bg-brand-500\\/20 { background-color: ${light} !important; }
    .hover\\:bg-brand-500\\/25:hover       { background-color: ${hex}40 !important; }

    /* Text */
    .text-brand-400, .text-brand-500      { color: ${text} !important; }
    .hover\\:text-brand-400:hover          { color: ${text} !important; }

    /* Borders */
    .border-brand-500, .border-brand-600  { border-color: ${hex} !important; }
    .border-brand-500\\/25, .border-brand-500\\/30 { border-color: ${border30} !important; }
    .border-brand-500\\/60                { border-color: ${border60} !important; }

    /* Ring (focus outline) */
    .ring-brand-500, .focus\\:ring-brand-500 { --tw-ring-color: ${hex} !important; }
    .focus\\:border-brand-500              { border-color: ${hex} !important; }

    /* Shadow */
    .shadow-brand-500\\/10, .shadow-brand-500\\/20, .shadow-brand-500\\/30 {
      --tw-shadow-color: ${hex} !important;
    }
    .hover\\:shadow-brand-500\\/10:hover   { --tw-shadow-color: ${hex}1a !important; }

    /* Gradient */
    .gradient-brand { background: linear-gradient(135deg, ${hex}, ${dark}) !important; }

    /* Pill tabs active */
    .pill-tab-active,
    button.bg-brand-500.text-white        { background-color: ${hex} !important; border-color: ${dark} !important; }

    /* Top bar nav active state */
    .bg-brand-500\\/15                    { background-color: ${lighter} !important; }
  `;

  /* Also update CSS custom properties for any components using var(--brand) */
  const root = document.documentElement;
  root.style.setProperty('--brand',      hex);
  root.style.setProperty('--brand-dark', dark);
  root.style.setProperty('--brand-text', text);
}

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8)  & 0xff;
  let b =  n        & 0xff;
  if (pct > 0) {
    r = Math.min(255, Math.round(r + (255 - r) * pct / 100));
    g = Math.min(255, Math.round(g + (255 - g) * pct / 100));
    b = Math.min(255, Math.round(b + (255 - b) * pct / 100));
  } else {
    r = Math.max(0, Math.round(r * (1 + pct / 100)));
    g = Math.max(0, Math.round(g * (1 + pct / 100)));
    b = Math.max(0, Math.round(b * (1 + pct / 100)));
  }
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function useSettings() { return useContext(SettingsContext); }
