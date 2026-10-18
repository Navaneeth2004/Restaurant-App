'use strict';
/** Public/unauthenticated endpoints get a tiny body limit; logged-in ones 10 MB (bug reports can carry a screenshot). */
const express = require('express');

const smallJson = express.json({ limit: '20kb' });
const bigJson = express.json({ limit: '10mb' });
const bigForm = express.urlencoded({ limit: '10mb', extended: true });

module.exports = (req, res, next) => {
  if (req._smallBody) return smallJson(req, res, next);
  return bigJson(req, res, (err) => (err ? next(err) : bigForm(req, res, next)));
};
