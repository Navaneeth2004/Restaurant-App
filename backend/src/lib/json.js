'use strict';
/** JSON.parse that gives `fallback` for empty or broken text. */
const parseJson = (text, fallback) => {
  try { return text ? JSON.parse(text) : fallback; } catch (_) { return fallback; }
};

module.exports = { parseJson };
