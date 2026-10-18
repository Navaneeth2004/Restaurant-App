'use strict';
/** The one way an image gets into a restaurant's uploads folder (menu import, restore, legacy import). */
const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const MAX_ITEM_IMAGE = 5 * 1024 * 1024;
const MAX_LOGO_IMAGE = 2 * 1024 * 1024;

/** Saves image bytes under a fresh name (never overwrites). @returns public URL, or null when rejected */
function storeImageBuffer(rid, originalName, buffer, { prefix = 'item', maxBytes = MAX_ITEM_IMAGE } = {}) {
  const base = path.basename(String(originalName));
  if (!paths.isAllowedName(base) || buffer.length > maxBytes) return null;
  const stored = paths.newName(prefix, path.extname(base));
  fs.writeFileSync(path.join(paths.uploadsDir(rid), stored), buffer);
  return paths.publicUrl(rid, stored);
}

/** Copies an image file from another folder (legacy import). @returns public URL, or null when rejected */
function storeImageFile(rid, sourceFile, opts = {}) {
  try {
    const stat = fs.statSync(sourceFile);
    if (!stat.isFile()) return null;
    return storeImageBuffer(rid, sourceFile, fs.readFileSync(sourceFile), opts);
  } catch (_) { return null; }
}

module.exports = { storeImageBuffer, storeImageFile, MAX_ITEM_IMAGE, MAX_LOGO_IMAGE };
