'use strict';
/**
 * Orders are stored in UTC; "today" and every report date is the restaurant's LOCAL calendar day.
 * Clients send tz_offset_min (minutes ahead of UTC, e.g. 330 for India).
 */
const MAX_OFFSET = 14 * 60;

function parseOffset(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n)) : 0;
}

const offsetFromQuery = (req) => parseOffset(req.query && req.query.tz_offset_min);

function modifier(offset) {
  const o = parseOffset(offset);
  return `'${o >= 0 ? '+' : '-'}${Math.abs(o)} minutes'`;
}

/** SQL: local YYYY-MM-DD of an ISO timestamp column. */
const localDaySql = (column, offset) => `substr(datetime(${column}, ${modifier(offset)}), 1, 10)`;
/** SQL: local YYYY-MM of an ISO timestamp column. */
const localMonthSql = (column, offset) => `substr(datetime(${column}, ${modifier(offset)}), 1, 7)`;

const localToday = (offset) => new Date(Date.now() + parseOffset(offset) * 60000).toISOString().slice(0, 10);

/** JS: ISO timestamp -> local "YYYY-MM-DD". */
const localDayOf = (iso, offset) => new Date(new Date(iso).getTime() + parseOffset(offset) * 60000).toISOString().slice(0, 10);

/** JS: ISO timestamp -> local "dd-mm-yyyy" (GST invoice date). */
function localDMY(iso, offset) {
  const [y, m, d] = localDayOf(iso, offset).split('-');
  return `${d}-${m}-${y}`;
}

/** JS: ISO timestamp -> local "HH:MM:SS". */
const localTimeOf = (iso, offset) =>
  new Date(new Date(iso).getTime() + parseOffset(offset) * 60000).toISOString().slice(11, 19);

module.exports = {
  parseOffset, offsetFromQuery, localDaySql, localMonthSql, localToday, localDayOf, localDMY, localTimeOf,
};
