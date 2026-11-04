# Deploying Restaurant POS

The supported setup is **one small server on the internet, behind HTTPS**, serving every restaurant.
Phones, tablets and PCs just open a web address. Nothing is installed at the restaurant.

The backend serves the built frontend itself, so there is one program to run (Node.js) and one port (4000).

> **Never expose port 4000 directly.** Put a reverse proxy with HTTPS in front (Step 4). The sign-in cookies are
> marked Secure and will not work over plain HTTP in production.

---

## 1. What you need

- A Linux server (1 vCPU / 1 GB RAM is enough to start) with a public IP
- A domain name pointing at it, for example `pos.example.com`
- Node.js 18 or newer
- Git, and a build toolchain only if `npm install` cannot fetch a ready-made SQLite binary
  (`sudo apt install build-essential python3`)

## 2. Get the code and build

```bash
sudo mkdir -p /opt/restaurant-pos && sudo chown $USER /opt/restaurant-pos
git clone <your-repo-url> /opt/restaurant-pos
cd /opt/restaurant-pos

cd backend  && npm install --omit=dev
cd ../frontend && npm install && npm run build      # creates frontend/build
```

(Use `npm ci` instead of `npm install` once a `package-lock.json` is committed.)

## 3. Configure the backend

```bash
cd /opt/restaurant-pos/backend
cp .env.example .env
nano .env
```

The settings that matter:

| Setting | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | the proxy forwards to this |
| `DATA_DIR` | `/var/lib/restaurant-pos` | **all** data lives here; outside the code folder so updates never touch it |
| `COOKIE_SECURE` | `true` | cookies only over HTTPS |
| `TRUST_PROXY` | `1` | one proxy in front, so real client IPs are seen (rate limits depend on it) |
| `PUBLIC_URL` | `https://pos.example.com` | used in staff pairing links |
| `ALLOW_REGISTRATION` | `true` or `false` | `true` lets anyone create a restaurant account. Set `false` once you only onboard customers yourself from the root console |
| `ENFORCE_TRIAL` | `false` | set `true` when billing exists; trial restaurants are then blocked after their trial ends |
| `CORS_ORIGINS` | empty | only needed if the frontend is served from a different address |

Create the data folder:

```bash
sudo mkdir -p /var/lib/restaurant-pos && sudo chown $USER /var/lib/restaurant-pos
```

## 4. Run it

### As a service (systemd)

Create `/etc/systemd/system/restaurant-pos.service`:

```ini
[Unit]
Description=Restaurant POS
After=network.target

[Service]
WorkingDirectory=/opt/restaurant-pos/backend
ExecStart=/usr/bin/node server.js
Restart=always
User=pos
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /usr/sbin/nologin pos
sudo chown -R pos /var/lib/restaurant-pos
sudo systemctl daemon-reload
sudo systemctl enable --now restaurant-pos
sudo journalctl -u restaurant-pos -f          # watch the log
```

The log should say how many owners and restaurants exist and that secure cookies are ON.

### HTTPS with Caddy (simplest)

`/etc/caddy/Caddyfile`:

```
pos.example.com {
    reverse_proxy localhost:4000
}
```

Caddy gets and renews the certificate by itself and handles live-update connections automatically.

### HTTPS with nginx (alternative)

```nginx
server {
    server_name pos.example.com;
    client_max_body_size 70m;                 # backup restore allows up to 60 MB
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;       # live updates need WebSocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo certbot --nginx -d pos.example.com`.

Open only ports 80 and 443 in the firewall.

## 5. Create your root login

The root console (`https://pos.example.com/root`) is for you, the operator. Root accounts can only be made on the
server, never through the website:

```bash
cd /opt/restaurant-pos/backend
node scripts/admin.js create-root 9876543210 "a-long-password-of-10+-characters"
```

Use a phone number that is not also a restaurant owner. Log in at `/root`, then **Restaurants → New restaurant**
to onboard a customer. The screen shows the owner password and admin PIN **once**; hand them over.

Owners can also sign themselves up from the home page if `ALLOW_REGISTRATION=true`.

## 6. Connect the restaurant's devices

1. On the first device, open `https://pos.example.com`, choose **I'm the owner — log in**, enter phone + password.
2. Enter the admin PIN to open the app.
3. For each further phone or tablet: **Admin → Devices → Create pairing code**, then on that device choose
   **I'm staff — connect with a code** and type the 6-digit code (or scan the QR). A code lasts 10 minutes, works
   once, and can lock the device to waiter-only or kitchen-only.
4. Remove a lost device at once under Admin → Devices.
5. Print table QR codes under **Admin → Tables** (QR icon). Customers need no app and no login.

Tip: "Add to Home screen" in the phone browser gives one-tap access.

## 7. Backups (do this before the first real customer)

SQLite databases are live files, so **do not copy them while the app runs**. Use the built-in snapshot, which is
safe at any time:

```bash
cd /opt/restaurant-pos/backend
node scripts/admin.js backup-all /var/backups/pos     # accounts.db + every restaurant, keeps the newest 14
```

Photos and ticket screenshots are plain files, so copy those too:

```bash
rsync -a /var/lib/restaurant-pos/files   /var/backups/pos-files/
rsync -a /var/lib/restaurant-pos/tickets /var/backups/pos-files/
```

Run both every night with cron (`crontab -e`):

```
0 3 * * * cd /opt/restaurant-pos/backend && node scripts/admin.js backup-all /var/backups/pos
30 3 * * * rsync -a /var/lib/restaurant-pos/files /var/lib/restaurant-pos/tickets /var/backups/pos-files/
```

Then copy `/var/backups/pos*` off the server (another machine or cloud storage). A backup on the same disk
does not survive that disk failing.

Each restaurant admin can also download or restore their own restaurant as a zip from the app's **Backup** tab.
A restore replaces that restaurant's data and signs everyone out.

**Restoring a whole server:** stop the service, copy `accounts.db` to `DATA_DIR/`, the `tenants/*.db` files to
`DATA_DIR/tenants/`, and the `files/` and `tickets/` folders back; delete any `*-wal` and `*-shm` files next to the
databases; start the service.

## 8. Updating

```bash
cd /opt/restaurant-pos
git pull
cd backend  && npm install --omit=dev
cd ../frontend && npm install && npm run build
cd ../backend && node scripts/admin.js backup-all /var/backups/pos     # a safety copy first
sudo systemctl restart restaurant-pos
```

Database changes are applied automatically the first time each restaurant opens after an update
(`node scripts/admin.js migrate` does them all at once). Your data folder is never touched by `git pull`.
After an update, ask staff to refresh the page so they pick up the new version.

## 9. Everyday support commands

Run on the server from `backend/`: `node scripts/admin.js` lists them all.

| Command | Use |
|---|---|
| `list` | all restaurants, status, plan, devices |
| `suspend <id>` / `activate <id>` | block or restore every device of a restaurant |
| `revoke-devices <id>` | after a security scare: everyone must link their device again |
| `set-password <phone> <new>` | an owner forgot their password |
| `disable-owner` / `enable-owner <phone>` | block or restore an owner login |
| `delete-restaurant <id> --yes` | permanent: database and photos |
| `list-roots` / `remove-root <phone>` | manage root logins |
| `import-legacy --db … --phone … --password …` | move an old single-restaurant install in |
| `backup-all [folder]` | snapshots, see step 7 |
| `migrate` | apply database updates now |

Most of these are also buttons in the root console.

If an **admin** forgets their PIN: another admin changes it under Admin → Staff. If there is no other admin, the owner
can ask you to create one for them, or you can restore from a backup.

## 10. Security checklist

- HTTPS only; `COOKIE_SECURE=true`; port 4000 not reachable from outside.
- Strong root password; root accounts exist only if you made them with `create-root`.
- Decide on `ALLOW_REGISTRATION`.
- Keep Node.js and the operating system updated.
- Test a restore from backup at least once, on a spare machine.
- Customer QR codes are links with long random tokens. Anyone holding a table's QR can order for that table, so print
  them on the table, not on the street.

---

## Appendix: one PC inside a single restaurant (no internet server)

This still works for a restaurant that wants everything on one computer and its own Wi-Fi, but it is **not** the
supported path, and the backup tab then offers manual download/restore only. I have not re-tested it on the
current version, so try it before relying on it.

In `backend/.env`:

```
NODE_ENV=production
DEPLOYMENT=local
COOKIE_SECURE=false          # plain HTTP on the local network
DATA_DIR=./data
```

Build the frontend as in step 2, start with `node server.js` (or the Windows scripts in `start/`), and open
`http://<the PC's address>:4000` on phones on the same Wi-Fi. In this mode the table QR codes use the PC's local
address. Give the PC a fixed address in your router so bookmarks keep working, allow port 4000 in the Windows
firewall, and **never forward that port to the internet**: without HTTPS the sign-in cookies travel unprotected.

Back up by copying the whole `backend/data` folder while the server is stopped, or use the Backup tab's download.