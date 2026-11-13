'use strict';
/**
 * Orders are stored in UTC; "today" and every report date is the restaurant's LOCAL calendar day.
 * The offset (minutes ahead of UTC, e.g. 330 for India) is stored per restaurant (setting tz_offset_min); the first
 * client that asks for a report sets it, so every device of one restaurant files the same days afterwards.
 */
const MAX_OFFSET = 14 * 60;

function parseOffset(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n)) : 0;
}

function offsetFromQuery(req) {
  const asked = req.query && req.query.tz_offset_min;
  const fromClient = parseOffset(asked);
  try {
    const settings = require('../repositories/catalog/settings.repo');
    const stored = settings.get('tz_offset_min');
    if (stored !== null && stored !== undefined && stored !== '') return parseOffset(stored);
    if (asked !== undefined) settings.set('tz_offset_min', String(fromClient));
  } catch (_) { /* no restaurant context: use what the client sent */ }
  return fromClient;
}

function modifier(offset) {
  const o = parseOffset(offset);
  return `'${o >= 0 ? '+' : '-'}${Math.abs(o)} minutes'`;
}

/** SQL: local YYYY-MM-DD of an ISO timestamp column (for grouping; filter with dayRangeUtc so an index can be used). */
const localDaySql = (column, offset) => `substr(datetime(${column}, ${modifier(offset)}), 1, 10)`;
const localMonthSql = (column, offset) => `substr(datetime(${column}, ${modifier(offset)}), 1, 7)`;

const localToday = (offset) => new Date(Date.now() + parseOffset(offset) * 60000).toISOString().slice(0, 10);

const dayParts = (day) => String(day).split('-').map(Number);
const addDaysStr = (day, n) => { const [y, m, d] = dayParts(day); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const nextDay = (day) => addDaysStr(day, 1);
/** The UTC instant at which a LOCAL day starts, as an ISO string. */
const dayStartUtcIso = (day, offset) => { const [y, m, d] = dayParts(day); return new Date(Date.UTC(y, m - 1, d) - parseOffset(offset) * 60000).toISOString(); };
/** [lo, hi) in UTC covering the local days from..to inclusive. */
const dayRangeUtc = (from, to, offset) => ({ lo: dayStartUtcIso(from, offset), hi: dayStartUtcIso(nextDay(to), offset) });

const localDayOf = (iso, offset) => new Date(new Date(iso).getTime() + parseOffset(offset) * 60000).toISOString().slice(0, 10);

function localDMY(iso, offset) {
  const [y, m, d] = localDayOf(iso, offset).split('-');
  return `${d}-${m}-${y}`;
}

const localTimeOf = (iso, offset) =>
  new Date(new Date(iso).getTime() + parseOffset(offset) * 60000).toISOString().slice(11, 19);

module.exports = {
  parseOffset, offsetFromQuery, localDaySql, localMonthSql, localToday, localDayOf, localDMY, localTimeOf,
  addDaysStr, nextDay, dayStartUtcIso, dayRangeUtc,
};
