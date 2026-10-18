'use strict';
/**
 * Support tool for the person running the service (run on the server):  node scripts/admin.js <command> ...
 * To add a command: create a file in ./commands exporting { usage, run(args) } and list it in COMMANDS below.
 */
const tenants = require('../db/tenant/manager');

const COMMANDS = {
  ...require('./commands/roots'),
  ...require('./commands/restaurants'),
  ...require('./commands/owners'),
  ...require('./commands/backup'),
  ...require('./commands/migrate'),
  ...require('./commands/import-legacy'),
};

async function main(argv) {
  const [name, ...args] = argv;
  const command = COMMANDS[name];
  if (!command) {
    console.log('Commands:');
    for (const c of Object.values(COMMANDS)) console.log(`  ${c.usage}`);
    return;
  }
  try { await command.run(args); }
  catch (e) { console.error(e.message || e); process.exitCode = 1; }
  finally { tenants.closeAll(); }
}

module.exports = { main };
