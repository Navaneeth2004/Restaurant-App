'use strict';
/** multer that stores into the CURRENT restaurant's folder, with friendly JSON errors. */
const multer = require('multer');
const path = require('path');
const ctx = require('../../db/context');
const { HttpError } = require('../../lib/http');
const paths = require('./paths');

/** multer finishes on another async tick; continue inside the request's tenant context. */
const resume = (req, next) => (req._ctx ? ctx.run(req._ctx, next) : next());

function makeUploader(prefix, maxMb) {
  const m = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => { try { cb(null, paths.uploadsDir(req.restaurantId)); } catch (e) { cb(e); } },
      filename: (req, file, cb) => cb(null, paths.newName(prefix, path.extname(file.originalname))),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = paths.ALLOWED_MIME.has(file.mimetype) && paths.isAllowedName(file.originalname);
      ok ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG, WEBP or GIF images are allowed'));
    },
  });

  const single = (field) => ctx.wrap((req, res, next) => m.single(field)(req, res, (err) => {
    if (!err) return resume(req, next);
    if (err instanceof HttpError) return next(err);
    return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${maxMb} MB).` : err.message));
  }));

  return { single };
}

/** In-memory upload (zip files). `accept(file)` decides whether the file type is allowed. */
function makeMemoryUploader(maxMb, accept, rejectMessage) {
  const m = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => (accept(file) ? cb(null, true) : cb(new HttpError(400, rejectMessage))),
  });
  const single = (field) => ctx.wrap((req, res, next) => m.single(field)(req, res, (err) => {
    if (!err) return resume(req, next);
    if (err instanceof HttpError) return next(err);
    return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${maxMb} MB).` : err.message));
  }));
  return { single };
}

const isZip = (file) => /zip/.test(file.mimetype) || /\.zip$/i.test(file.originalname);

module.exports = { makeUploader, makeMemoryUploader, isZip };
