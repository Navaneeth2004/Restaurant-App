'use strict';
/** "Mobile - Chrome", "Windows PC - Edge" ... from a user-agent string. */
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
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari'
    : '';
  return browser ? `${device} - ${browser}` : device;
}

module.exports = { guessDeviceName };
