'use strict';

const express  = require('express');
const router   = express.Router();
const archiver = require('archiver');
const AdmZip   = require('adm-zip');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db/database');

const dataDir    = path.join(__dirname, '..', 'data');
const dbPath     = path.join(dataDir, 'restaurant.db');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const tokenFile  = path.join(dataDir, 'gdrive_tokens.json');
const metaFile   = path.join(dataDir, 'gdrive_meta.json');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function loadTokens() { try { return JSON.parse(fs.readFileSync(tokenFile,'utf8')); } catch { return null; } }
function saveTokens(t) { fs.writeFileSync(tokenFile, JSON.stringify(t), 'utf8'); }
function loadMeta()    { try { return JSON.parse(fs.readFileSync(metaFile,'utf8')); } catch { return {}; } }
function saveMeta(m)   { fs.writeFileSync(metaFile, JSON.stringify({ ...loadMeta(), ...m }), 'utf8'); }

function getCredentials() {
  const row = db.prepare("SELECT value FROM settings WHERE key='gdrive_credentials'").get();
  if (!row?.value) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

// FIX: redirect_uri is derived from the incoming request's host at runtime,
// NOT from stored credentials. This means it always matches whatever URL
// the browser is currently using (localhost OR 192.168.x.x).
function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers.host; // e.g. "localhost:4000" or "192.168.1.43:4000"
  return `${proto}://${host}/api/backup/gdrive/callback`;
}

function buildOAuthClient(redirectUri) {
  try {
    const { google } = require('googleapis');
    const creds = getCredentials();
    if (!creds) return null;
    const oAuth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
    const tokens = loadTokens();
    if (tokens) oAuth2.setCredentials(tokens);
    oAuth2.on('tokens', newTokens => saveTokens({ ...loadTokens(), ...newTokens }));
    return oAuth2;
  } catch { return null; }
}

function buildBackupBuffer() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const arch   = archiver('zip', { zlib: { level: 6 } });
    arch.on('data', c => chunks.push(c));
    arch.on('end',  () => resolve(Buffer.concat(chunks)));
    arch.on('error', reject);
    if (fs.existsSync(dbPath))     arch.file(dbPath, { name: 'restaurant.db' });
    if (fs.existsSync(uploadsDir)) arch.directory(uploadsDir, 'uploads');
    arch.finalize();
  });
}

// ── Auto-backup scheduler ─────────────────────────────────────────────────
let _scheduleTimer = null;
function stopSchedule() { if (_scheduleTimer) { clearInterval(_scheduleTimer); _scheduleTimer = null; } }

async function runAutoBackup() {
  const meta = loadMeta();
  if (!meta.schedule || meta.schedule === 'off') return;
  console.log('[Backup] Running scheduled backup...');
  try { await uploadToDrive(null); console.log('[Backup] Scheduled backup complete.'); }
  catch (e) { console.error('[Backup] Scheduled backup failed:', e.message); }
}

function startSchedule(ms) {
  stopSchedule();
  if (!ms) return;
  _scheduleTimer = setInterval(runAutoBackup, ms);
  console.log(`[Backup] Auto-backup every ${ms/60000} minutes.`);
}

const SCHEDULE_MS = { 'off':0, '1h':3600000, '2h':7200000, '6h':21600000, '12h':43200000, 'daily':86400000 };

// Init schedule on module load
(function() {
  const ms = SCHEDULE_MS[loadMeta().schedule || 'off'] || 0;
  if (ms > 0) startSchedule(ms);
})();

// ── Core Drive upload (redirectUri may be null for scheduled runs) ─────────
async function uploadToDrive(redirectUri) {
  const { google } = require('googleapis');
  const creds = getCredentials();
  if (!creds) throw new Error('Not configured');
  const tokens = loadTokens();
  if (!tokens) throw new Error('Not connected to Google Drive');

  // For scheduled runs we reuse stored redirect_uri; for manual we use live one
  const uri    = redirectUri || creds.redirect_uri || 'http://localhost:4000/api/backup/gdrive/callback';
  const oAuth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, uri);
  oAuth2.setCredentials(tokens);
  oAuth2.on('tokens', t => saveTokens({ ...loadTokens(), ...t }));

  const drive    = google.drive({ version: 'v3', auth: oAuth2 });
  const meta     = loadMeta();
  const filename = 'restaurant_pos_backup.zip';
  const buffer   = await buildBackupBuffer();
  const { Readable } = require('stream');

  // Find/create folder
  let folderId = meta.folder_id || null;
  if (!folderId) {
    const r = await drive.files.list({ q:`mimeType='application/vnd.google-apps.folder' and name='Restaurant POS Backups' and trashed=false`, fields:'files(id)' });
    folderId = r.data.files[0]?.id;
    if (!folderId) {
      const f = await drive.files.create({ requestBody:{ name:'Restaurant POS Backups', mimeType:'application/vnd.google-apps.folder' }, fields:'id' });
      folderId = f.data.id;
    }
  }

  // Check if file still exists
  let fileId = meta.file_id || null;
  if (fileId) { try { await drive.files.get({ fileId, fields:'id' }); } catch { fileId = null; } }

  let uploaded;
  if (fileId) {
    uploaded = await drive.files.update({ fileId, media:{ mimeType:'application/zip', body:Readable.from(buffer) }, fields:'id,name' });
  } else {
    uploaded = await drive.files.create({ requestBody:{ name:filename, parents:[folderId] }, media:{ mimeType:'application/zip', body:Readable.from(buffer) }, fields:'id,name' });
  }

  // Also save the redirect_uri we used so scheduled backups can reuse it
  if (redirectUri) saveMeta({ redirect_uri: redirectUri });
  saveMeta({ last_backup:new Date().toISOString(), last_filename:filename, folder_name:'Restaurant POS Backups', folder_id:folderId, file_id:uploaded.data.id });
  return { filename, folder:'Restaurant POS Backups', file_id:uploaded.data.id };
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get('/download', (req, res) => {
  const dateStr = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition',`attachment; filename="pos_backup_${dateStr}.zip"`);
  const arch = archiver('zip', { zlib:{ level:6 } });
  arch.on('error', e => { console.error(e); res.end(); });
  arch.pipe(res);
  if (fs.existsSync(dbPath))     arch.file(dbPath,     { name:'restaurant.db' });
  if (fs.existsSync(uploadsDir)) arch.directory(uploadsDir, 'uploads');
  arch.finalize();
});

router.post('/restore', upload.single('backup'), (req, res) => {
  if (!req.file) return res.status(400).json({ error:'No file uploaded' });
  try {
    const zip     = new AdmZip(req.file.buffer);
    const dbEntry = zip.getEntry('restaurant.db');
    if (!dbEntry) return res.status(400).json({ error:'Invalid backup — restaurant.db not found' });
    const tmp = dbPath + '.restore_tmp';
    fs.writeFileSync(tmp, dbEntry.getData());
    fs.renameSync(tmp, dbPath);
    let imgs = 0;
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive:true });
    zip.getEntries().forEach(e => {
      if (e.entryName.startsWith('uploads/') && !e.isDirectory) {
        fs.writeFileSync(path.join(uploadsDir, path.basename(e.entryName)), e.getData());
        imgs++;
      }
    });
    res.json({ success:true, message:`Restored. ${imgs} images restored. Restart the POS to apply.`, images_restored:imgs });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Restore failed' });
  }
});

// FIX: also expose the redirect_uri that will be used, so frontend can show it exactly
router.get('/gdrive/status', (req, res) => {
  const tokens = loadTokens();
  const meta   = loadMeta();
  const creds  = getCredentials();
  const redirectUri = getRedirectUri(req);
  res.json({
    configured:    !!creds,
    connected:     !!tokens,
    last_backup:   meta.last_backup   || null,
    last_filename: meta.last_filename || null,
    folder_name:   meta.folder_name   || null,
    schedule:      meta.schedule      || 'off',
    redirect_uri:  redirectUri,   // <-- what the backend will actually use
  });
});

router.put('/gdrive/credentials', (req, res) => {
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) return res.status(400).json({ error:'client_id and client_secret required' });
  // FIX: store without redirect_uri — we compute it at runtime from the request
  // Keep any existing redirect_uri in meta for scheduled backups fallback
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('gdrive_credentials', JSON.stringify({ client_id, client_secret }));
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  res.json({ success:true });
});

router.get('/gdrive/auth', (req, res) => {
  try {
    const { google } = require('googleapis');
    const creds = getCredentials();
    if (!creds) return res.status(400).json({ error:'Credentials not configured' });
    // FIX: always compute redirect_uri from the live request
    const redirectUri = getRedirectUri(req);
    const oAuth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
    const url = oAuth2.generateAuthUrl({ access_type:'offline', prompt:'consent', scope:['https://www.googleapis.com/auth/drive.file'] });
    // Return both the auth URL and the exact redirect_uri being used
    res.json({ url, redirect_uri: redirectUri });
  } catch (e) {
    res.status(500).json({ error:'googleapis not installed. Run: cd backend && npm install googleapis' });
  }
});

router.get('/gdrive/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const creds = getCredentials();
    if (!creds) return res.status(400).send('Not configured');
    // FIX: use the same redirect_uri that was used in the auth request
    const redirectUri = getRedirectUri(req);
    const { google } = require('googleapis');
    const oAuth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
    const { tokens } = await oAuth2.getToken(code);
    saveTokens(tokens);
    // Save the working redirect_uri for scheduled backups
    saveMeta({ redirect_uri: redirectUri });
    res.send(`<html><body style="font-family:sans-serif;background:#18181b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        <h2 style="margin:0 0 8px;font-size:20px">Google Drive connected!</h2>
        <p style="color:#71717a;margin:0;font-size:14px">You can close this window.</p>
      </div>
      <script>if(window.opener){window.opener.postMessage('gdrive_connected','*');}setTimeout(()=>window.close(),2000);</script>
    </body></html>`);
  } catch (e) {
    console.error('[Backup] OAuth error:', e.message);
    res.status(500).send(`<html><body style="font-family:sans-serif;background:#18181b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px">
      <div style="text-align:center;max-width:400px">
        <h2 style="color:#ef4444;margin:0 0 12px">Authentication failed</h2>
        <p style="color:#71717a;margin:0 0 8px;font-size:14px">${e.message}</p>
        <p style="color:#52525b;font-size:12px">Make sure this exact redirect URI is added in Google Cloud Console:</p>
        <code style="display:block;background:#111;padding:8px;border-radius:6px;margin-top:8px;font-size:11px;word-break:break-all;color:#a3e635">${getRedirectUri(req)}</code>
      </div>
    </body></html>`);
  }
});

router.post('/gdrive/upload', async (req, res) => {
  try {
    const redirectUri = getRedirectUri(req);
    const result = await uploadToDrive(redirectUri);
    res.json({ success:true, ...result });
  } catch (e) {
    console.error('[Backup] Upload error:', e.message);
    if (e.message?.includes('invalid_grant') || e.response?.status === 401) {
      if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
      return res.status(401).json({ error:'Google Drive session expired. Please reconnect.' });
    }
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

router.put('/gdrive/schedule', (req, res) => {
  const { schedule } = req.body;
  if (!SCHEDULE_MS.hasOwnProperty(schedule)) return res.status(400).json({ error:'Invalid schedule' });
  saveMeta({ schedule });
  const ms = SCHEDULE_MS[schedule] || 0;
  if (ms > 0) startSchedule(ms); else stopSchedule();
  res.json({ success:true, schedule });
});

router.delete('/gdrive/disconnect', (req, res) => {
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  saveMeta({ file_id:undefined, folder_id:undefined, last_backup:undefined, last_filename:undefined });
  res.json({ success:true });
});

module.exports = router;

// ── Local backup routes ───────────────────────────────────────────────────

const LOCAL_SCHEDULE_MS = { 'off':0, '1h':3600000, '2h':7200000, '6h':21600000, '12h':43200000, 'daily':86400000 };
let _localTimer = null;

function stopLocalSchedule() { if (_localTimer) { clearInterval(_localTimer); _localTimer = null; } }

async function runLocalBackup() {
  const meta = loadMeta();
  const folder = meta.local_folder;
  if (!folder || meta.local_schedule === 'off') return;
  console.log('[Backup] Running local scheduled backup...');
  try {
    const buffer   = await buildBackupBuffer();
    const dateStr  = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const filename = `pos_backup_${dateStr}.zip`;
    const dest     = path.join(folder, filename);
    fs.writeFileSync(dest, buffer);
    // Keep only last 7 backups in local folder
    const files = fs.readdirSync(folder)
      .filter(f => f.startsWith('pos_backup_') && f.endsWith('.zip'))
      .map(f => ({ name: f, time: fs.statSync(path.join(folder, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    files.slice(7).forEach(f => { try { fs.unlinkSync(path.join(folder, f.name)); } catch {} });
    saveMeta({ local_last_backup: new Date().toISOString(), local_last_filename: filename });
    console.log('[Backup] Local backup saved:', dest);
  } catch (e) {
    console.error('[Backup] Local backup failed:', e.message);
  }
}

function startLocalSchedule(ms) {
  stopLocalSchedule();
  if (!ms) return;
  _localTimer = setInterval(runLocalBackup, ms);
  console.log(`[Backup] Local auto-backup every ${ms/60000} minutes.`);
}

// Init local schedule on module load
(function() {
  const meta = loadMeta();
  const ms = LOCAL_SCHEDULE_MS[meta.local_schedule || 'off'] || 0;
  if (ms > 0 && meta.local_folder) startLocalSchedule(ms);
})();

// GET /api/backup/local/status
router.get('/local/status', (req, res) => {
  const meta = loadMeta();
  res.json({
    folder:        meta.local_folder       || null,
    schedule:      meta.local_schedule     || 'off',
    last_backup:   meta.local_last_backup  || null,
    last_filename: meta.local_last_filename|| null,
  });
});

// PUT /api/backup/local/config
router.put('/local/config', (req, res) => {
  const { folder, schedule } = req.body;
  if (folder && !fs.existsSync(folder)) {
    try { fs.mkdirSync(folder, { recursive: true }); }
    catch (e) { return res.status(400).json({ error: `Cannot create folder: ${e.message}` }); }
  }
  saveMeta({ local_folder: folder || null, local_schedule: schedule || 'off' });
  const ms = LOCAL_SCHEDULE_MS[schedule || 'off'] || 0;
  if (ms > 0 && folder) startLocalSchedule(ms);
  else stopLocalSchedule();
  res.json({ success: true });
});

// POST /api/backup/local/now — manual local backup
router.post('/local/now', async (req, res) => {
  const meta = loadMeta();
  let folder = meta.local_folder || req.body?.folder;
  if (!folder) {
    // Default to backend/data/backups if no folder configured
    folder = path.join(dataDir, 'backups');
  }
  try {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const buffer   = await buildBackupBuffer();
    const dateStr  = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const filename = `pos_backup_${dateStr}.zip`;
    const dest     = path.join(folder, filename);
    fs.writeFileSync(dest, buffer);
    saveMeta({ local_last_backup: new Date().toISOString(), local_last_filename: filename, local_folder: folder });
    res.json({ success: true, path: dest, filename });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Local backup failed' });
  }
});