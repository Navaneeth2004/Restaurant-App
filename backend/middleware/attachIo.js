// Attaches the socket.io instance to every request as req.io
// so route handlers can emit events without importing io directly
module.exports = (io) => (req, res, next) => {
  req.io = io;
  next();
};
