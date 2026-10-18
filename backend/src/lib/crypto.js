'use strict';
const crypto = require('crypto');

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const randomHex = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');
const randomDigits = (n = 6) => String(crypto.randomInt(0, 10 ** n)).padStart(n, '0');

function safeEqual(a, b) {
  const l = Buffer.from(String(a));
  const r = Buffer.from(String(b));
  return l.length === r.length && crypto.timingSafeEqual(l, r);
}

module.exports = { sha256, randomToken, randomHex, randomDigits, safeEqual, uuid: () => crypto.randomUUID() };
