import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { closeOrder } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { Order, Table } from '../types';

interface Props {
  orders: Order[];      // ALL rounds for this table
  orderId: string;      // ID to close (backend closes all for the table)
  table: Table | null;
  onClose: () => void;
  onClosed: () => void;
}

export default function BillModal({ orders, orderId, table, onClose, onClosed }: Props) {
  const settings = useSettings();
  const toast    = useToast();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;

  // Flatten all items from all rounds, merging duplicates by name+note+price
  const itemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.name}||${item.note || ''}||${item.price}`;
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        itemMap.set(key, { name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' });
      }
    }
  }
  const allItems = Array.from(itemMap.values());

  const subtotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;

  const handleMarkPaid = async () => {
    try {
      await closeOrder(orderId);
      toast('Table cleared — enjoy!', 'success');
      onClosed();
    } catch {
      toast('Failed to close order', 'error');
    }
  };

  return (
    /* bill-modal-overlay: targeted by print CSS to strip the dark backdrop */
    <div
      className="bill-modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* bill-print-area: the only element shown when printing */}
      <div
        className="bill-print-area bg-white text-gray-900 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-4 text-center">
          <div className="text-lg font-bold tracking-tight">{settings.restaurant_name}</div>
          {settings.address && <div className="text-xs text-gray-400 mt-0.5">{settings.address}</div>}
          {(settings as any).phone && <div className="text-xs text-gray-500 mt-0.5">{(settings as any).phone}</div>}
          <div className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleString()}</div>
        </div>

        {/* Receipt body */}
        <div className="px-5 py-4 font-mono text-xs">
          <div className="font-bold text-sm mb-3 font-sans">{table?.label || orders[0]?.table_id}</div>

          <div className="space-y-1.5 mb-3">
            {allItems.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span className="flex-1 pr-2">{item.quantity}× {item.name}</span>
                  <span className="font-medium">{sym}{(item.price * item.quantity).toFixed(2)}</span>
                </div>
                {item.note && (
                  <div className="text-gray-400 pl-3 text-[10px]">↳ {item.note}</div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Tax ({settings.tax_percent || 5}%)</span>
              <span>{sym}{tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-dashed border-gray-300 my-1.5" />
            <div className="flex justify-between font-bold text-sm font-sans">
              <span>TOTAL</span>
              <span>{sym}{total.toFixed(2)}</span>
            </div>
          </div>

          {settings.bill_footer && (
            <>
              <div className="border-t border-dashed border-gray-300 my-3" />
              <div className="text-center text-gray-400 text-[10px]">{settings.bill_footer}</div>
            </>
          )}
        </div>

        {/* Actions — hidden when printing */}
        <div className="no-print px-5 pb-5 flex flex-col gap-2">
          <button
            onClick={handleMarkPaid}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
          >
            Mark Paid &amp; Clear Table
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
          <p className="text-center text-gray-400 text-[10px] mt-1">
            Tip: set paper size to <strong>80mm</strong> in your printer dialog for thermal receipts
          </p>
        </div>
      </div>
    </div>
  );
}