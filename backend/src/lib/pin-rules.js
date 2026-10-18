'use strict';
/** PIN strength rules and the one definition of "is this a bcrypt hash". */
const HASH_RE = /^\$2[aby]\$/;
const isHashed = (v) => HASH_RE.test(String(v || ''));

const SEQUENCES = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'];

function pinProblem(value) {
  const pin = String(value || '');
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4–6 digits.';
  if (/^(\d)\1+$/.test(pin) || SEQUENCES.includes(pin)) return 'Choose a less predictable PIN.';
  return null;
}

module.exports = { pinProblem, isHashed, HASH_RE };
