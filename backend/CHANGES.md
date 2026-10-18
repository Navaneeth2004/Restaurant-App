# What changed vs the old backend

API URLs, request/response shapes, socket event names, cookies and npm scripts are unchanged, so the frontend
needs no change. Every intentional difference is below.

## Bugs fixed
1. **Customer QR codes now work** (tokens carry the restaurant id; old un-routable tokens are replaced on next "ensure-token").
2. Unknown `GET /api/...` paths no longer hang (frontend catch-all skips `/api` and `/uploads`).
3. **Tables with order history are archived** instead of failing to delete (foreign keys were silently ON).
4. Kitchen role can use `/staff/session/validate` and `/staff/logout`; logged-in staff can switch user.
5. "Already logged in on another device" check now works (blocks only a session active in the last 12 h; same device is recognised by its cookie). Switching user on a device ends the previous member's session.
6. **Staff sessions expire on the server** after 7 days.
7. The last active admin can no longer be demoted/deactivated (only delete was guarded before).
8. `max_tables` plan limit is enforced.
9. Live socket updates now stop when staff log out / are deactivated / change PIN (promote/demote were stubs that did not exist).
10. `limit({ key })` is honoured (bug-report limit is per device).
11. Registration no longer deletes the database of an account that was already created if the final step fails.
12. Duplicate category name → clear 409 (was a 500).
13. Phone numbers: one canonical form with country code, validated; old accounts stored as typed still log in.
14. `import-legacy` reports the real number of converted PINs.

## Security / robustness
* Customer (QR) orders read **name and price from the menu**; quantities/prices are validated for staff orders too.
* Rate limits on customer ordering and bill requests.
* `GET /uploads/...` no longer creates folders on disk.
* Admin-PIN check for deleting history now has the same lockout as other PIN checks and no plain-text fallback.
* Settings keys are validated (no secrets, sane names, tax 0–100).
* Rate-limit / fail-tracker / device-touch maps are swept (no unbounded growth).
* Tenant context is re-entered after body parsing / uploads, so no handler can lose its restaurant.
* AUTH_METHODS is enforced at login; list `limit` parameters are capped.

## Accounting
* **GST is computed per bill (dining visit), not per kitchen round**: one B2B invoice per visit, short invoice numbers (`INV-000123`, ≤16 chars) assigned when a visit is closed (older visits get `L<8 chars>`), invoice date in the restaurant's local time, each visit uses the tax rate in force when it was closed. GSTR-1 `order_count`/`doc_issued` now count bills.
* Payment method/amount lives on ONE row per visit; reports group by visit (no more "unknown" bucket for extra rounds); editing a payment clears stale payment data on the other rows.
* Revenue CSV/JSON: local dates, per-visit tax rate, one row per visit.
* Staff orders on parcel slots are marked `parcel` like customer orders. Totals are rounded to 2 decimals in one place.

## Removed (dead / duplicate)
Menu export/import duplicate in `export.js`, `core/staff-auth.js`, the in-flight lock sets (handlers are synchronous; transactions already guarantee atomicity), unused helpers, `BUG_REPORT_EMAIL`/`SMTP_*`, and dependencies `bonjour-service`, `googleapis`, `nodemailer`, `xlsx`.

## Behaviour you may notice
* New restaurants start with blank address/phone (was sample text); factory reset now restores the same defaults (8 tables).
* Sample menu prices are unchanged (still dollar-style numbers).
* Tenant databases upgrade automatically via numbered migrations on first open (existing databases are safe).

## Deliberately NOT changed (decide later)
* `GET /settings` is still readable before the PIN (the frontend may rely on it for branding/tax).
* `DEPLOYMENT=local` mode only keeps `/kiosk/lan-ip`; the `.bat` files and DEPLOY.md still describe local mode.
* Money is still stored as REAL (rounded in one place).
* Docs to fix outside the backend: README vs DEPLOY.md contradict each other (sql.js vs better-sqlite3; default PINs 0000/1111/2222 are now rejected by the PIN rules); `LIcense.txt` typo; `START_POS.bat` matches `:4000` as a substring (can kill port 40001).
