'use strict';
/**
 * Per-restaurant file storage:  DATA_DIR/files/<restaurantId>/uploads/<name>   ->  public URL /uploads/<restaurantId>/<name>
 * Only JPG / PNG / WEBP / GIF are accepted (never SVG, which can carry scripts).
 */
const fs = require('fs');
const path = require('path');
const cfg = require('../../config/env');
const { isRestaurantId } = require('../../lib/ids');
const { randomHex } = require('../../lib/crypto');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function assertId(rid) {
  if (!isRestaurantId(rid)) throw new Error('Invalid restaurant id');
}

const restaurantRoot = (rid) => { assertId(rid); return path.join(cfg.FILES_DIR, rid); };

/** The uploads folder (created on demand). */
function uploadsDir(rid) {
  const dir = path.join(restaurantRoot(rid), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** The uploads folder only if it already exists (public file serving must never create folders). */
function existingUploadsDir(rid) {
  if (!isRestaurantId(rid)) return null;
  const dir = path.join(cfg.FILES_DIR, rid, 'uploads');
  return fs.existsSync(dir) ? dir : null;
}

function newName(prefix, ext) {
  let e = String(ext || '').toLowerCase();
  if (!ALLOWED_EXT.has(e)) e = '.jpg';
  return `${prefix}_${Date.now()}_${randomHex(4)}${e}`;
}

const publicUrl = (rid, name) => { assertId(rid); return `/uploads/${rid}/${path.basename(String(name))}`; };
const isAllowedName = (name) => ALLOWED_EXT.has(path.extname(String(name)).toLowerCase());

/** Works for new URLs (/uploads/<rid>/<file>) and legacy ones (/uploads/<file>). Never leaves the folder. */
function resolveUpload(rid, imagePath) {
  if (!imagePath) return null;
  const dir = uploadsDir(rid);
  const full = path.join(dir, path.basename(String(imagePath)));
  return full.startsWith(dir + path.sep) ? full : null;
}

function removeUpload(rid, imagePath) {
  const file = resolveUpload(rid, imagePath);
  if (file) { try { fs.unlinkSync(file); } catch (_) { /* already gone */ } }
}

function clearUploads(rid) {
  const dir = uploadsDir(rid);
  for (const f of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, f)); } catch (_) { /* skip */ } }
}

const removeRestaurantFiles = (rid) => fs.rmSync(restaurantRoot(rid), { recursive: true, force: true });

module.exports = {
  ALLOWED_EXT, ALLOWED_MIME, uploadsDir, existingUploadsDir, newName, publicUrl, isAllowedName,
  resolveUpload, removeUpload, clearUploads, removeRestaurantFiles,
};
