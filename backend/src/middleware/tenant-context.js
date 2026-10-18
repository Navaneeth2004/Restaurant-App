'use strict';
/**
 * Body parsing finishes on a different async tick, which can drop the request's tenant context.
 * This middleware (mounted AFTER the parsers) re-enters it, so every route handler is safe by construction.
 */
const ctx = require('../db/context');

module.exports = (req, res, next) => (req._ctx ? ctx.run(req._ctx, next) : next());
