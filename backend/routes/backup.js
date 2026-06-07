/**
 * backend/routes/backup.js
 *
 * GET  /api/backup/download  — streams the database + uploads folder as a .zip
 * GET  /api/backup/gdrive/auth   — starts Google OAuth flow
 * GET  /api/backup/gdrive/callback — OAuth callback, stores tokens
 * POST /api/backup/gdrive/upload  — uploads backup zip to Google Drive
 * GET  /api/backup/gdrive/status  — returns whether Drive is connected + last backup info
 * DELETE /api/backup/gdrive/disconnect — removes stored tokens
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const archiver = require('archiver');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db/database');

const dataDir    = path.join(__dirname, '..', 'data');
const dbPath     = path.join(dataDir, 'restaurant.db');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const tokenFile  = path.join(dataDir, 'gdrive_tokens.json');
const metaFile   = path.join(dataDir, 'gdrive_meta.json');

// ── Helpers ───────────────────────────────────────────────────────────────
function loadTokens() {
  try { return JSON.parse(fs.readFileSync(tokenFile, 'utf8')); } catch { return null; }
}
function saveTokens(t) { fs.writeFileSync(tokenFile, JSON.stringify(t), 'utf8'); }
function loadMeta()   {
  try { return JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { return null; }
}
function saveMeta(m)  { fs.writeFileSync(metaFile, JSON.stringify(m), 'utf8'); }

function getOAuthClient() {
  try {
    const { google } = require('googleapis');
    const creds = db.prepare("SELECT value FROM settings WHERE key = 'gdrive_credentials'").get();
    if (!creds?.value) return null;
    const { client_id, client_secret, redirect_uri } = JSON.parse(creds.value);
    const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
    const tokens = loadTokens();
    if (tokens) oAuth2.setCredentials(tokens);
    return oAuth2;
  } catch { return null; }
}

// ── GET /api/backup/download ──────────────────────────────────────────────
// Streams a zip of the database file (+ uploads folder) for direct download
router.get('/download', (req, res) => {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="pos_backup_${dateStr}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { console.error('[Backup] archive error:', err); res.end(); });
  archive.pipe(res);

  // Include database
  if (fs.existsSync(dbPath)) {
    archive.file(dbPath, { name: 'restaurant.db' });
  }

  // Include uploaded images
  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, 'uploads');
  }

  archive.finalize();
});

// ── GET /api/backup/gdrive/status ─────────────────────────────────────────
router.get('/gdrive/status', (req, res) => {
  const tokens    = loadTokens();
  const meta      = loadMeta();
  const credRow   = db.prepare("SELECT value FROM settings WHERE key = 'gdrive_credentials'").get();
  const hasClient = !!credRow?.value;
  res.json({
    configured:    hasClient,
    connected:     !!tokens,
    last_backup:   meta?.last_backup   || null,
    last_filename: meta?.last_filename || null,
    folder_name:   meta?.folder_name   || null,
  });
});

// ── PUT /api/backup/gdrive/credentials ───────────────────────────────────
// Saves the OAuth client credentials (client_id, client_secret, redirect_uri)
router.put('/gdrive/credentials', (req, res) => {
  const { client_id, client_secret, redirect_uri } = req.body;
  if (!client_id || !client_secret || !redirect_uri) {
    return res.status(400).json({ error: 'client_id, client_secret, redirect_uri required' });
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('gdrive_credentials', JSON.stringify({ client_id, client_secret, redirect_uri }));
  // Clear any old tokens since credentials changed
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  res.json({ success: true });
});

// ── GET /api/backup/gdrive/auth ───────────────────────────────────────────
router.get('/gdrive/auth', (req, res) => {
  try {
    const { google } = require('googleapis');
    const oAuth2 = getOAuthClient();
    if (!oAuth2) return res.status(400).json({ error: 'Google Drive credentials not configured yet.' });

    const url = oAuth2.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',
      scope:       ['https://www.googleapis.com/auth/drive.file'],
    });
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: 'googleapis not installed. Run: cd backend && npm install googleapis' });
  }
});

// ── GET /api/backup/gdrive/callback ──────────────────────────────────────
router.get('/gdrive/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const oAuth2 = getOAuthClient();
    if (!oAuth2) return res.status(400).send('Not configured');
    const { tokens } = await oAuth2.getToken(code);
    saveTokens(tokens);
    // Close the popup and notify the opener
    res.send(`
      <html><body style="font-family:sans-serif;background:#18181b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <div style="font-size:48px;margin-bottom:16px">✓</div>
          <h2 style="margin:0 0 8px">Google Drive connected!</h2>
          <p style="color:#71717a;margin:0">You can close this window.</p>
        </div>
        <script>
          if (window.opener) { window.opener.postMessage('gdrive_connected', '*'); }
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `);
  } catch (e) {
    console.error('[Backup] OAuth callback error:', e.message);
    res.status(500).send('Authentication failed: ' + e.message);
  }
});

// ── POST /api/backup/gdrive/upload ────────────────────────────────────────
router.post('/gdrive/upload', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const oAuth2 = getOAuthClient();
    if (!oAuth2) return res.status(400).json({ error: 'Not configured' });
    const tokens = loadTokens();
    if (!tokens)  return res.status(401).json({ error: 'Not connected to Google Drive' });

    // Refresh token if expired
    oAuth2.setCredentials(tokens);
    oAuth2.on('tokens', (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      saveTokens(merged);
    });

    const drive    = google.drive({ version: 'v3', auth: oAuth2 });
    const dateStr  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `pos_backup_${dateStr}.zip`;

    // Build zip in memory (db is small — typically < 5MB)
    const archiver = require('archiver');
    const { PassThrough } = require('stream');
    const passThrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(passThrough);
    if (fs.existsSync(dbPath))     archive.file(dbPath, { name: 'restaurant.db' });
    if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
    archive.finalize();

    // Find or create "Restaurant POS Backups" folder
    let folderId = null;
    const folderName = 'Restaurant POS Backups';
    const folderSearch = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id,name)',
    });
    if (folderSearch.data.files.length > 0) {
      folderId = folderSearch.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      folderId = folder.data.id;
    }

    // Upload
    const uploaded = await drive.files.create({
      requestBody: {
        name:    filename,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/zip',
        body:     passThrough,
      },
      fields: 'id,name,size',
    });

    // Save meta
    saveMeta({
      last_backup:   new Date().toISOString(),
      last_filename: filename,
      folder_name:   folderName,
      file_id:       uploaded.data.id,
    });

    res.json({
      success:  true,
      filename,
      folder:   folderName,
      file_id:  uploaded.data.id,
    });

  } catch (e) {
    console.error('[Backup] Upload error:', e.message);
    // Token revoked or expired beyond refresh
    if (e.message?.includes('invalid_grant') || e.response?.status === 401) {
      if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
      return res.status(401).json({ error: 'Google Drive session expired. Please reconnect.' });
    }
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

// ── DELETE /api/backup/gdrive/disconnect ──────────────────────────────────
router.delete('/gdrive/disconnect', (req, res) => {
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  if (fs.existsSync(metaFile))  fs.unlinkSync(metaFile);
  res.json({ success: true });
});

module.exports = router;