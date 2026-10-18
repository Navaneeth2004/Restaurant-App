'use strict';
/**
 * End-to-end smoke test:  node tests/run.js   (uses a throw-away data folder)
 * Each file in tests/suites is one area; they run in order and share `S` (ids created by earlier suites).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = path.join(os.tmpdir(), `pos-test-${Date.now()}`);
process.env.DATA_DIR = DATA;
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const { createApp } = require('../src/app');
const tenants = require('../src/db/tenant/manager');
const { Client } = require('./client');

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`, extra === undefined ? '' : JSON.stringify(extra)); }
}

async function main() {
  const { server, io } = createApp();
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const t = {
    base, check, S: {}, Client, fs, path, DATA, tz: '?tz_offset_min=330',
    A: new Client(base), B: new Client(base), anon: new Client(base),
  };
  const suites = fs.readdirSync(path.join(__dirname, 'suites')).filter(f => f.endsWith('.js')).sort();
  for (const file of suites) await require(`./suites/${file}`)(t);

  console.log(`\n${passed} passed, ${failed} failed`);
  io.close(); server.close(); tenants.closeAll();
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
