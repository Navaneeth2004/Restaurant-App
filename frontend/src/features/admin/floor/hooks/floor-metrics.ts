import { sumLines } from 'lib/format/money';
import { isParcelTable } from 'lib/input/ids';
import { minutesSince } from 'lib/format/local-time';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';

export type Heat = 'empty' | 'fresh' | 'warm' | 'hot' | 'bill';

export function tableHeat(status: Table['status'], mins: number): Heat {
  if (status === 'empty') return 'empty';
  if (status === 'waiting_bill') return 'bill';
  return mins < 30 ? 'fresh' : mins < 60 ? 'warm' : 'hot';
}

export interface FloorMetrics {
  dineIn: Table[]; parcels: Table[];
  occupied: number; free: number; billPending: number; parcelActive: number; overdue: number;
  totalSeats: number; occupiedSeats: number; seatPct: number;
  kitchenValue: number; itemsInKitchen: number;
  breakdown: { fresh: number; warm: number; hot: number; bill: number; available: number };
}

/** Everything the floor tiles show. Parcel slots are counted separately and never mixed into dine-in numbers. */
export function computeFloorMetrics(tables: ReadonlyArray<Table>, active: ReadonlyArray<Order>, nowMs: number): FloorMetrics {
  const dineIn = tables.filter(t => !isParcelTable(t));
  const parcels = tables.filter(isParcelTable);
  const heatOf = (t: Table): Heat => tableHeat(t.status, minutesSince(t.occupied_since, nowMs));
  const heats = dineIn.map(heatOf);
  const busy = dineIn.filter(t => t.status !== 'empty');
  const totalSeats = dineIn.reduce((s, t) => s + t.seats, 0);
  const occupiedSeats = busy.reduce((s, t) => s + t.seats, 0);
  const items = active.flatMap(o => o.items);
  return {
    dineIn, parcels, occupied: busy.length, free: dineIn.length - busy.length,
    billPending: heats.filter(h => h === 'bill').length, parcelActive: parcels.filter(t => t.status !== 'empty').length,
    overdue: heats.filter(h => h === 'hot').length, totalSeats, occupiedSeats,
    seatPct: totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0,
    kitchenValue: sumLines(items), itemsInKitchen: items.reduce((s, i) => s + i.quantity, 0),
    breakdown: {
      fresh: heats.filter(h => h === 'fresh').length, warm: heats.filter(h => h === 'warm').length,
      hot: heats.filter(h => h === 'hot').length, bill: heats.filter(h => h === 'bill').length, available: heats.filter(h => h === 'empty').length,
    },
  };
}
