'use strict';
/** Barrier 2: which staff member (if any) is behind this request? Never rejects; routes decide via middleware/access.js. */
const { STAFF_COOKIE } = require('../../lib/cookies');
const sessions = require('../../services/staff/sessions');

module.exports = (store, cookies) => { store.staff = sessions.resolveFromCookie(cookies[STAFF_COOKIE]); };
