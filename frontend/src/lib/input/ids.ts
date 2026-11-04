const PARCEL_RE = /^P\d+$/;

export const isParcelId = (tableId: string): boolean => PARCEL_RE.test(tableId);

export function tableDisplayLabel(tableId: string): string {
  return isParcelId(tableId) ? `Parcel ${tableId.slice(1)}` : `Table ${tableId}`;
}

/** Prefers the server flag; falls back to the id pattern for older responses. */
export const isParcelTable = (t: { id: string; is_parcel?: 0 | 1 }): boolean => (t.is_parcel === undefined ? isParcelId(t.id) : t.is_parcel === 1);
