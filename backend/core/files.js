'use strict';
/**
 * Per-restaurant file storage (menu photos, logo).
 *
 *   DATA_DIR/files/<restaurantId>/uploads/<name>
 *   public URL:  /uploads/<restaurantId>/<name>
 *
 * Only JPG / PNG / WEBP / GIF are accepted (never SVG, which can carry scripts).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');

const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isRestaurantId(rid) {
  const value = String(rid);
  return /^[a-f0-9]{10}$/i.test(value) || /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
}
function assertId(rid) {
  if (!isRestaurantId(rid)) throw new Error('Invalid restaurant id');
}
function uploadsDir(rid) {
  assertId(rid);
  const d = path.join(cfg.DATA_DIR, 'files', rid, 'uploads');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function newName(prefix, ext) {
  ext = String(ext || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) ext = '.jpg';
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
}
const publicUrl = (rid, name) => {
  assertId(rid);
  return `/uploads/${rid}/${path.basename(String(name))}`;
};
const isAllowedName = (name) => ALLOWED_EXT.has(path.extname(String(name)).toLowerCase());

/** Works for new URLs (/uploads/<rid>/<file>) and legacy ones (/uploads/<file>). Never leaves the folder. */
function resolveUpload(rid, imagePath) {
  if (!imagePath) return null;
  const dir = uploadsDir(rid);
  const full = path.join(dir, path.basename(String(imagePath)));
  return full.startsWith(dir + path.sep) ? full : null;
}
function removeUpload(rid, imagePath) {
  const f = resolveUpload(rid, imagePath);
  if (f) { try { fs.unlinkSync(f); } catch (_) {} }
}
function clearUploads(rid) {
  const d = uploadsDir(rid);
  for (const f of fs.readdirSync(d)) { try { fs.unlinkSync(path.join(d, f)); } catch (_) {} }
}

/** multer instance that stores into the CURRENT restaurant's folder (req.restaurantId is set by the gate). */
function makeUploader(prefix, maxMb) {
  const multer = require('multer');
  const ctx = require('./context');
  const m = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => { try { cb(null, uploadsDir(req.restaurantId)); } catch (e) { cb(e); } },
      filename: (req, file, cb) => cb(null, newName(prefix, path.extname(file.originalname))),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = ALLOWED_MIME.has(file.mimetype) && isAllowedName(file.originalname);
      ok ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
    },
  });
  return { single: (field) => ctx.wrap(m.single(field)) };
}

module.exports = {
  ALLOWED_EXT, isRestaurantId, uploadsDir, newName, publicUrl, isAllowedName,
  resolveUpload, removeUpload, clearUploads, makeUploader,
};