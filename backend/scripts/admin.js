'use strict';
/**
 * Support tool for YOU (the person running the service). Run on the server:
 *
 *   node scripts/admin.js create-root <phone> <password>     create the ROOT login for /root (the only way to make one)
 *   node scripts/admin.js list-roots | remove-root <phone>
 *   node scripts/admin.js list
 *   node scripts/admin.js suspend  <restaurantId>      block every device of that restaurant
 *   node scripts/admin.js activate <restaurantId>
 *   node scripts/admin.js set-password <phone> <newPassword>      (owner forgot the password)
 *   node scripts/admin.js disable-owner <phone>  |  enable-owner <phone>
 *   node scripts/admin.js revoke-devices <restaurantId>           (e.g. after a security scare)
 *   node scripts/admin.js backup-all [folder]          consistent copy of accounts.db + every restaurant DB (keeps the newest 14)
 *   node scripts/admin.js migrate                    open every restaurant DB once so schema updates apply now
 *   node scripts/admin.js delete-restaurant <restaurantId> --yes  PERMANENT: database + photos
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const cfg = require('../core/config');
const central = require('../core/central');
const tenants = require('../core/tenants');
const { normalizePhone, nowIso } = require('../core/util');

const [cmd, a, b, c] = process.argv.slice(2);
const phoneOf = (x) => { const p = normalizePhone(x, cfg.DEFAULT_COUNTRY_CODE); if (!p) { console.error('Invalid phone'); process.exit(1); } return p; };
const must = (cond, msg) => { if (!cond) { console.error(msg); process.exit(1); } };

(async () => {
  switch (cmd) {
    case 'create-root': {
      must(a && b, 'usage: create-root <phone> <password>');
      must(String(b).length >= 10, 'A root password should be at least 10 characters');
      const phone = phoneOf(a);
      const existing = central.prepare('SELECT * FROM owners WHERE phone = ?').get(phone);
      must(!existing || existing.role === 'root', 'That phone number is already a restaurant owner account. Use a different number for root.');
      const hash = await bcrypt.hash(String(b), 12);
      if (existing) central.prepare('UPDATE owners SET password_hash = ?, disabled = 0, updated_at = ? WHERE id = ?').run(hash, nowIso(), existing.id);
      else central.prepare("INSERT INTO owners (id, phone, password_hash, role, created_at, updated_at) VALUES (?,?,?,'root',?,?)")
        .run(require('crypto').randomUUID(), phone, hash, nowIso(), nowIso());
      console.log(`Root account ready for ${phone}. Open https://<your-site>/root to log in.`);
      break;
    }
    case 'list-roots': {
      console.table(central.prepare("SELECT phone, disabled, created_at FROM owners WHERE role = 'root'").all());
      break;
    }
    case 'remove-root': {
      must(a, 'usage: remove-root <phone>');
      const n = central.prepare("DELETE FROM owners WHERE phone = ? AND role = 'root'").run(phoneOf(a)).changes;
      must(n, 'No root account with that phone');
      console.log('Removed.');
      break;
    }
    case 'list': {
      const rows = central.prepare(`
        SELECT r.id, r.name, r.status, r.plan, r.created_at, o.phone,
               (SELECT COUNT(*) FROM devices d WHERE d.restaurant_id = r.id AND d.revoked_at IS NULL) AS devices
        FROM restaurants r JOIN owners o ON o.id = r.owner_id ORDER BY r.created_at`).all();
      console.table(rows.map(r => ({ id: r.id, name: r.name, owner: r.phone, status: r.status, plan: r.plan, devices: r.devices, created: r.created_at.slice(0, 10) })));
      break;
    }
    case 'suspend':
    case 'activate': {
      must(a, 'restaurantId required');
      const n = central.prepare('UPDATE restaurants SET status = ? WHERE id = ?').run(cmd === 'suspend' ? 'suspended' : 'active', a).changes;
      must(n, 'No such restaurant');
      console.log(`${a} is now ${cmd === 'suspend' ? 'suspended' : 'active'} (takes effect on the next request).`);
      break;
    }
    case 'set-password': {
      must(a && b, 'usage: set-password <phone> <newPassword>');
      must(String(b).length >= 8, 'Password must be at least 8 characters');
      const n = central.prepare('UPDATE owners SET password_hash = ?, updated_at = ? WHERE phone = ?')
        .run(await bcrypt.hash(String(b), 11), nowIso(), phoneOf(a)).changes;
      must(n, 'No owner with that phone');
      console.log('Password updated.');
      break;
    }
    case 'disable-owner':
    case 'enable-owner': {
      const n = central.prepare('UPDATE owners SET disabled = ? WHERE phone = ?').run(cmd === 'disable-owner' ? 1 : 0, phoneOf(a)).changes;
      must(n, 'No owner with that phone');
      console.log('Done.');
      break;
    }
    case 'revoke-devices': {
      must(a, 'restaurantId required');
      const n = central.prepare('UPDATE devices SET revoked_at = ? WHERE restaurant_id = ? AND revoked_at IS NULL').run(nowIso(), a).changes;
      console.log(`${n} device(s) revoked. Everyone must link their device again.`);
      break;
    }
    case 'backup-all': {
      const dest = path.resolve(a || path.join(cfg.DATA_DIR, '..', 'pos-backups'));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const out = path.join(dest, stamp);
      fs.mkdirSync(path.join(out, 'tenants'), { recursive: true });
      await central.backup(path.join(out, 'accounts.db'));
      const ids = central.prepare('SELECT id FROM restaurants').all();
      for (const { id } of ids) await tenants.get(id).raw.backup(path.join(out, 'tenants', `${id}.db`));
      const old = fs.readdirSync(dest).filter(n => /^\d{4}-/.test(n)).sort().slice(0, -14);
      old.forEach(n => fs.rmSync(path.join(dest, n), { recursive: true, force: true }));
      console.log(`Backed up accounts + ${ids.length} restaurant DB(s) to ${out}`);
      console.log('Photos are in DATA_DIR/files — copy that folder too (rsync / rclone).');
      break;
    }
    case 'migrate': {
      const ids = central.prepare('SELECT id FROM restaurants').all();
      for (const { id } of ids) { tenants.get(id); process.stdout.write('.'); }
      console.log(`\nMigrated ${ids.length} restaurant database(s).`);
      break;
    }
    case 'delete-restaurant': {
      must(a, 'restaurantId required');
      must(b === '--yes', 'This permanently deletes the restaurant. Re-run with --yes to confirm.');
      const r = central.prepare('SELECT * FROM restaurants WHERE id = ?').get(a);
      must(r, 'No such restaurant');
      tenants.close(a);
      central.transaction(() => {
        central.prepare('DELETE FROM pairing_codes WHERE restaurant_id = ?').run(a);
        central.prepare('DELETE FROM devices WHERE restaurant_id = ?').run(a);
        central.prepare('DELETE FROM restaurants WHERE id = ?').run(a);
      })();
      tenants.remove(r.db_file);
      fs.rmSync(path.join(cfg.DATA_DIR, 'files', a), { recursive: true, force: true });
      console.log(`Deleted restaurant ${a} (${r.name}). The owner account was kept.`);
      break;
    }
    default:
      console.log('Commands: create-root <phone> <pw> | list-roots | remove-root <phone> | list | backup-all [folder] | suspend <id> | activate <id> | set-password <phone> <pw> | disable-owner <phone> | enable-owner <phone> | revoke-devices <id> | migrate | delete-restaurant <id> --yes');
  }
  tenants.closeAll();
})().catch(e => { console.error(e); process.exit(1); });