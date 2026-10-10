# Restaurant POS

A full-stack Point of Sale system with real-time kitchen display, order management, and admin panel.

---

## Requirements

- Node.js 18 or newer
- A modern browser (Chrome recommended for kitchen display)
- For production, a persistent server disk and HTTPS

The backend uses `better-sqlite3`. Windows installations may need a supported
prebuilt binary or the Visual Studio C++ build tools if npm cannot download one.

---

## Quick Start

### Step 1 — Install dependencies

Open a terminal, navigate to this folder, and run:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

Both installs are pure JavaScript — no compilation step, no Visual Studio / build tools required on any OS.

---

### Step 2 — Configure and start the backend

Copy `backend/.env.example` to `backend/.env` if you do not already have one.
For local HTTP testing, use `NODE_ENV=development`, `DEPLOYMENT=cloud`,
`COOKIE_SECURE=false`, and a persistent `DATA_DIR` such as `./data`.

```bash
cd backend
npm start
```

### Step 3 — Start the frontend

Open a **second terminal window**:

```bash
cd frontend
npm start
```

The app opens at **http://localhost:3000**. First create an owner account and
restaurant, then staff can enter a PIN. To link another device, create a
one-time code in **Admin → Devices** and enter it on that device.

---

## Accessing from other devices (phones, kitchen screen)

Keep `REACT_APP_API_URL` empty in `frontend/.env`; `src/setupProxy.js` proxies
API and Socket.IO traffic to the backend during development so device cookies
remain same-origin. Open the frontend's LAN address from other devices.

---

## Cloud deployment

The browser must first link to a restaurant using an owner phone/password or a
short-lived pairing code. Staff then sign in with a PIN. Both barriers use
httpOnly cookies; PIN failures are rate-limited. Each restaurant has a separate
SQLite file under `DATA_DIR/tenants/`, while `DATA_DIR/accounts.db` stores
owners, restaurants, linked devices, and pairing codes.

For production, set `NODE_ENV=production`, `COOKIE_SECURE=true`,
`TRUST_PROXY=1`, and `PUBLIC_URL=https://your-domain`. Serve HTTPS through a
reverse proxy and set `DATA_DIR` to persistent storage. Back up the entire
`DATA_DIR` directory. Batch 1 keeps uploads shared and disables backup/reset
routes in cloud mode; see the batch notes before enabling more servers.

---

New restaurants choose their first admin PIN during registration. When
importing a legacy database, existing staff PINs are retained and upgraded to
bcrypt hashes; change weak PINs in **Admin → Staff**.

---

## Features

### Waiter View
- Select a table → add items by category → set per-item notes (e.g. "no onions")
- Send to kitchen — kitchen gets a sound alert instantly via WebSocket
- Generate bill with itemised receipt and tax
- Mark table as paid and clear it

### Kitchen Display
- All active orders shown as cards
- Live timer on each order — turns red after the configured overdue threshold
- Sound chime on every new order (Web Audio, no files needed)
- "Mark as Delivered" closes the order from kitchen

### Admin Panel
- **Restaurant**: name, address, bill footer, currency, tax %, brand color, GST settings
- **Tables**: add/delete/edit tables with seat count, drag to reorder, QR codes for customer self-ordering
- **Menu Items**: add/edit/delete with image upload, description, price, category, availability toggle
- **Categories**: add/rename/delete menu categories
- **Staff**: add/remove staff with PIN and role
- Admin can access all views (Waiter, Kitchen, Reports, Export, Backup, Admin)

### Reports
- Today's revenue, order count, active orders, occupied tables
- 30-day revenue bar chart
- Top selling items today
- Full order history with date filter and search

### Export
- GSTR-1, GSTR-3B, and GSTR-9 GST filing exports/previews

### Backup
- Local deployment: manual download/restore, scheduled auto-backup, and Google Drive backup
- Cloud deployment: backup and factory reset are disabled in Batch 1; uploads are still shared

---

## Project Structure

```
restaurant-pos/
├── backend/
│   ├── core/                   # Central accounts, tenant DBs, schema, auth context
│   ├── db/database.js          # Tenant-aware database proxy
│   ├── middleware/             # Device/staff auth, rate limits, Socket.IO scoping
│   ├── routes/
│   │   ├── settings.js
│   │   ├── categories.js
│   │   ├── menu.js             # Includes image upload (multer)
│   │   ├── tables.js
│   │   ├── orders.js
│   │   ├── staff.js
│   │   ├── reports.js
│   │   ├── export.js           # GST filing exports
│   │   ├── backup.js           # Local + Google Drive backup
│   │   ├── reset.js            # Factory reset
│   │   ├── parcel.js           # Parcel/takeaway slots
│   │   ├── kiosk.js            # Customer self-order QR flow
│   │   └── bug-report.js
│   ├── server.js               # Express + Socket.IO entry point
│   └── package.json
│
├── frontend/
│   ├── .env                    # API URL config — edit this for your IP
│   └── src/
│       ├── components/         # Shared UI (LoginScreen, TopBar, BillModal)
│       ├── context/            # Auth, Toast, Settings, AdminLock providers
│       ├── hooks/               # useSocket, useTick, useSortable
│       ├── services/            # api.ts, socket.ts
│       ├── utils/                # sound, diagnostics, sessions, authedFetch, etc.
│       └── views/               # WaiterView, KitchenView, AdminView, ReportsView, ExportView, BackupView, KioskView
│           └── admin/           # Admin sub-tabs
│
├── uploads/                    # Shared food item images + logo (Batch 1)
├── backend/data/
│   ├── accounts.db             # Owners, restaurants, devices, pairing codes
│   └── tenants/                # One restaurant SQLite file per tenant
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Real-time | Socket.IO (WebSocket) |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 (one file per restaurant) |
| File uploads | Multer |
| HTTP client | Axios |

---

## Troubleshooting

**`Cannot find module 'socket.io'`** — The `npm install` failed silently. Delete `node_modules` folder and run `npm install` again.

**`allowedHosts` error in frontend** — Make sure the `.env` file exists in the `frontend/` folder.

**Kitchen screen not getting orders** — Edit `frontend/.env` and set `REACT_APP_API_URL` to your computer's local IP (not localhost). Then restart the frontend.

**Images not showing on other devices** — Same as above — set the IP in `.env`.

**Port already in use** — `set PORT=4001 && npm start` (Windows) or `PORT=4001 npm start` (Mac/Linux)
