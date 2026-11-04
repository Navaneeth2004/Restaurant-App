/**
 * A tiny, strict CSV writer: UTF-8 with a BOM (so Excel shows ₹ and non-English names correctly), CRLF lines,
 * a cell is quoted only when it has to be, numbers are written bare (so Excel can sum them), and text that
 * could run as a spreadsheet formula is defused.
 */
export type Cell = string | { num: number; dp: number };

export const money = (num: number): Cell => ({ num, dp: 2 });
export const count = (num: number): Cell => ({ num, dp: 0 });

const FORMULA_START = /^[=+\-@\t\r]/;
const PHONE = /^\+[\d\s()-]+$/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export function textCell(value: string): string {
  const safe = FORMULA_START.test(value) && !PHONE.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const render = (c: Cell): string => (typeof c === 'string' ? textCell(c) : Number.isFinite(c.num) ? c.num.toFixed(c.dp) : '');

export function toCsv(header: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<Cell>>): string {
  return `\uFEFF${[header.map(textCell), ...rows.map(r => r.map(render))].map(r => r.join(',')).join('\r\n')}\r\n`;
}
