# Backend architecture

## The one rule: dependencies point down

```
routes  ->  services  ->  repositories  ->  db
  HTTP only   business rules   SQL only      connections, migrations
```

* **routes/** parse the request, call ONE service, send the response. No SQL, no business rules.
* **services/** hold every rule (who may do what, totals, GST, limits). They never touch `req`/`res`
  (they receive plain values) and never write SQL. Shared by the HTTP routes AND the CLI.
* **repositories/** are the only place with SQL. One file per table/area.
* **lib/** = pure helper functions (money, phone, ids, time...). **config/** = env + constants.
* Nothing is defined twice: if two files need it, it lives in `lib/` or a service.

## Folder map (src/)

| Folder | What lives there |
|---|---|
| `config/` | `env.js` (only reader of process.env) · `plans.js` · `defaults.js` (seed + reset) · `gst.js` |
| `lib/` | `money` `phone` `ids` `local-time` `pin-rules` `cookies` `crypto` `input` `http` `fail-tracker` |
| `db/` | `context.js` (current restaurant) · `central/` (accounts.db + migrations) · `tenant/` (one DB per restaurant: manager, proxy, migrations, seed) |
| `repositories/` | `central/` (owners, restaurants, devices, tickets...) · `catalog/` (menu, categories, tables, settings) · `orders/` · `staff/` |
| `services/` | `orders/` `billing/` `staff/` `devices/` `restaurants/` `auth/` `catalog/` `kiosk/` `files/` `backup/` `reports/` `support/` `root/` |
| `middleware/` | `gate/` (who is calling) · `access.js` (what they may do) · parsers, errors, rate limit |
| `realtime/` | Socket.IO: `bus.js` (the only handle), `rooms.js`, `order-events.js`, `socket-server.js` |
| `routes/` | one folder/file per feature + `index.js` (the registry) |
| `cli/` | `index.js` + `commands/` (one small file per command group) |

## How a request flows

`gate` (which restaurant? which staff member?) → body parsers → `tenant-context` (re-enters the restaurant
context) → `req.io` → route → `access.*` guard → service → repository → the restaurant's own SQLite file.

## Access control (declared per route)

Every route must name who may call it; the server **refuses to start** otherwise (`routes/index.js`).

`access.public` · `access.device` (linked device, no PIN needed) · `access.any` (admin/waiter/kitchen) ·
`access.floor` (admin/waiter) · `access.admin` · `access.root` (platform operator)

## Adding a feature (example: discounts)

1. `repositories/orders/discounts.repo.js` — the SQL.
2. `services/billing/discounts.js` — the rules (throw `fail(400, '...')` for user errors).
3. `routes/discounts.js` — endpoints, each with an `access.*`.
4. One line in `routes/index.js`.
5. New column/table? Add the next numbered file in `db/tenant/migrations/` and list it in its `index.js`.
6. Realtime update? Add a function to `realtime/order-events.js`.
7. Add a suite file in `tests/suites/` and run `npm test`.

## Database rules

* Schema changes are **numbered migrations** (`PRAGMA user_version`). Never edit an old one.
* Tenant DBs are opened lazily, migrated on first open, and cached with their prepared statements.
* Use `db/tenant/tx.js` (`tx(() => {...})`) for anything that must be atomic.
* Money: round only through `lib/money.js`. Dates: local days only through `lib/local-time.js`.

## Commands

```
npm start                       run the server
npm test                        end-to-end smoke tests (throw-away data folder)
node scripts/admin.js           list CLI commands (create-root, list, suspend, backup-all, migrate ...)
node scripts/import-legacy.js   move an old single-restaurant install into the multi-restaurant layout
```
