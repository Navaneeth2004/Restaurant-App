'use strict';
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const isGstin = (v) => GSTIN_RE.test(String(v || '').trim().toUpperCase());

module.exports = { isGstin };
