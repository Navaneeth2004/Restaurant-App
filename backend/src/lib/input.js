'use strict';
/** Small input-cleaning helpers. */
const clip = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);

const toInt = (v, fallback = null) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/** Positive integer capped at `max`; anything else becomes `fallback`. */
const limitParam = (v, fallback, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

/** "YYYY-MM-DD" that is a real calendar date, else null. */
const dateOrNull = (v) => {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

module.exports = { clip, toInt, limitParam, dateOrNull, isNum };
