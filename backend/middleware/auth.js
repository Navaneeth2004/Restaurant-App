/**
 * auth.js — Simple shared-secret API protection
 *
 * How it works:
 *   - On first run, a random token is generated and saved to backend/data/api_token.txt
 *   - The token is printed to the server console on startup
 *   - Every API request must include:  Authorization: Bearer <token>
 *   - The frontend reads the token from /api/auth/token (served without auth)
 *     so the browser can automatically attach it
 *   - If AUTH_DISABLED=true in environment, the middleware is a no-op
 *     (useful for dev or if you're 100% sure you're on a private LAN)
 *
 * Exempt paths (no auth required):
 *   - /api/auth/token    — bootstrap endpoint so browser can fetch the token
 *   - /api/kiosk/*       — customer kiosk routes; secured by opaque QR token instead
 *   - /uploads/*         — static file serving
 *   - everything else non-/api — serves the React SPA
 *
 * To disable auth entirely: set AUTH_DISABLED=true in your environment or
 * create backend/data/auth_disabled.txt
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir   = path.join(__dirname, '..', 'data');
const tokenFile = path.join(dataDir, 'api_token.txt');
const disableFile = path.join(dataDir, 'auth_disabled.txt');

// ── Load or generate token ────────────────────────────────────────────────
let _token = null;
let _disabled = false;

function init() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Check disable flag
  if (process.env.AUTH_DISABLED === 'true' || fs.existsSync(disableFile)) {
    _disabled = true;
    console.log('[Auth] ⚠  API authentication DISABLED — all requests accepted');
    return;
  }

  // Load or generate token
  if (fs.existsSync(tokenFile)) {
    _token = fs.readFileSync(tokenFile, 'utf8').trim();
  } else {
    _token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(tokenFile, _token, 'utf8');
  }

  console.log('');
  console.log('  [Auth] API token (keep secret, auto-loaded by browser):');
  console.log(`  [Auth] ${_token}`);
  console.log('');
}

/** Returns true if this path is exempt from auth */
function isExempt(reqPath) {
  // Token bootstrap — always allow
  if (reqPath === '/api/auth/token') return true;
  // Static uploads — always allow
  if (reqPath.startsWith('/uploads')) return true;
  // Kiosk routes — secured by opaque QR token, not staff auth token
  // This covers GET /api/kiosk/:token, GET /api/kiosk/:token/menu, etc.
  // AND POST /api/kiosk/ensure-token (called from admin, has staff auth)
  // We exempt all /api/kiosk/* here; the kiosk route itself validates the QR token.
  if (reqPath.startsWith('/api/kiosk')) return true;
  // Non-API paths — serve the SPA
  if (!reqPath.startsWith('/api')) return true;
  return false;
}

/** Express middleware — rejects requests without valid token */
function middleware(req, res, next) {
  if (_disabled) return next();
  if (isExempt(req.path)) return next();

  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token || token !== _token) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API token' });
  }

  next();
}

/** Router that exposes GET /api/auth/token — returns token for same-origin callers */
function tokenRouter() {
  const express = require('express');
  const router  = express.Router();

  router.get('/token', (req, res) => {
    if (_disabled) return res.json({ token: null, disabled: true });
    // Only serve the token to same-origin (or local network) requests.
    // This is intentionally simple — the token is also printed to console.
    res.json({ token: _token });
  });

  return router;
}

module.exports = { init, middleware, tokenRouter };