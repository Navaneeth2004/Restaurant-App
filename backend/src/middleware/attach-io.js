'use strict';
/** req.io.emit(event, data) reaches only the restaurant the request belongs to. */
const bus = require('../realtime/bus');

module.exports = (req, res, next) => {
  req.io = { emit: (event, data) => bus.emit(req.restaurantId, event, data) };
  next();
};
