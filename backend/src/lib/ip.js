'use strict';
/** Key for rate limits: IPv4 as is, IPv6 reduced to its /64 (one customer owns a whole /64). */
function ipKey(ip) {
  const s = String(ip || 'unknown');
  if (!s.includes(':')) return s;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) return s.replace(/^::ffff:/i, '');
  const parts = s.split('::');
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
  const fill = parts.length > 1 ? new Array(Math.max(0, 8 - head.length - tail.length)).fill('0') : [];
  return `${[...head, ...fill, ...tail].slice(0, 4).map(g => g || '0').join(':')}::/64`;
}

module.exports = { ipKey };
