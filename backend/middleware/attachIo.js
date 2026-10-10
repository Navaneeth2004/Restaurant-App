'use strict';

const ctx = require('../core/context');

function attachIo(io) {
  return (req, res, next) => {
    const context = ctx.get();
    const tenantRoom = context.restaurantId ? `t:${context.restaurantId}` : null;

    req.io = {
      emit(event, payload) {
        if (tenantRoom) io.to(tenantRoom).emit(event, payload);
        const tableId = req.kioskTableId || context.tableId ||
          payload?.tableId || payload?.table_id || payload?.order?.table_id || payload?.table?.id;
        const tableRoom = context.restaurantId && tableId
          ? `t:${context.restaurantId}:table:${tableId}`
          : null;
        if (tableRoom) io.to(tableRoom).emit(event, payload);
        return this;
      },
      promoteDevice: (...args) => io.promoteDevice?.(...args),
      demoteDevice: (...args) => io.demoteDevice?.(...args),
      demoteStaff: (...args) => io.demoteStaff?.(...args),
      revokeDevice: (...args) => io.revokeDevice?.(...args),
    };
    next();
  };
}

module.exports = attachIo;
