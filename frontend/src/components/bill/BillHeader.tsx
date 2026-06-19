/**
 * components/bill/BillHeader.tsx
 *
 * Branded bill header — logo, restaurant name, address, phone, table pill.
 */

import React from 'react';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
const sans = 'system-ui,-apple-system,sans-serif';

interface Props {
  restaurantName: string;
  address?:       string;
  phone?:         string;
  logoUrl?:       string;
  brand:          string;
  tableLabel:     string;
  dateStr:        string;
  timeStr:        string;
}

export default function BillHeader({
  restaurantName,
  address,
  phone,
  logoUrl,
  brand,
  tableLabel,
  dateStr,
  timeStr,
}: Props) {
  return (
    <div
      className="bill-header flex-shrink-0"
      style={{ background: brand, padding: '16px 20px 14px', textAlign: 'center' }}
    >
      {logoUrl && (
        <img
          src={`${API_BASE}${logoUrl}`}
          alt="logo"
          style={{
            width: 52, height: 52, borderRadius: 10,
            objectFit: 'cover', marginBottom: 8, display: 'inline-block',
          }}
        />
      )}
      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: sans }}>
        {restaurantName || 'Restaurant'}
      </div>
      {address && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: sans }}>
          {address}
        </div>
      )}
      {phone && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: sans }}>
          {phone}
        </div>
      )}
      <div
        className="bill-header-pill"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.18)', borderRadius: 20, padding: '2px 10px',
          fontSize: 11, color: '#fff', fontFamily: sans, marginTop: 7,
        }}
      >
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        {tableLabel}
        <span style={{ opacity: 0.6 }}>·</span>
        {dateStr}
        <span style={{ opacity: 0.6 }}>·</span>
        {timeStr}
      </div>
    </div>
  );
}