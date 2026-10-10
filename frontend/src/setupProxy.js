'use strict';

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.POS_BACKEND_URL || 'http://localhost:4000';
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: false,
    ws: true,
    logLevel: 'warn',
  });
  app.use('/api', proxy);
  app.use('/socket.io', proxy);
};
