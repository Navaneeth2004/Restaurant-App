'use strict';

const crypto = require('crypto');

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-15);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function guessDeviceName(userAgent) {
  const ua = String(userAgent || '');
  const device = /iPad|Tablet/i.test(ua) ? 'Tablet'
    : /iPhone|Android|Mobile/i.test(ua) ? 'Mobile'
    : /Windows/i.test(ua) ? 'Windows PC'
    : /Macintosh|Mac OS/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux PC'
    : 'Device';
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) && !/Edg\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Safari'
    : '';
  return browser ? `${device} - ${browser}` : device;
}

function nowIso() {
  return new Date().toISOString();
}

function newRestaurantId() {
  return crypto.randomBytes(5).toString('hex');
}

function pinProblem(value) {
  const pin = String(value || '');
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4–6 digits.';
  if (/^(\d)\1+$/.test(pin) || ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'].includes(pin)) {
    return 'Choose a less predictable PIN.';
  }
  return null;
}

module.exports = { normalizePhone, pinProblem, sha256, safeEqual, guessDeviceName, nowIso, newRestaurantId };
