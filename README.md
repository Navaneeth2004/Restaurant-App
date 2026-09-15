# Restaurant POS

A full-stack Point of Sale system with real-time kitchen display, order management, and admin panel.

---

## Requirements

- **Node.js v18 or v20** — https://nodejs.org (use the LTS version — v22 has a known issue with react-scripts)
- A modern browser (Chrome recommended for kitchen display)
- All devices must be on the **same Wi-Fi network**

> The database runs on **sql.js** (pure JavaScript/WASM SQLite) — there is **no native module to compile**, so `npm install` should just work on any platform, including Windows, without build tools of any kind.

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

### Step 2 — Start the backend

```bash
cd backend
npm start
```

You should see:
```
Restaurant APP — Backend running
http://localhost:4000
```

### Step 3 — Start the frontend

Open a **second terminal window**:

```bash
cd frontend
npm start
```

The app opens at **http://localhost:3000**

---

## Accessing from other devices (phones, kitchen screen)

1. Find your computer's local IP address:
   - **Windows**: Open CMD → type `ipconfig` → look for "IPv4 Address" e.g. `192.168.1.10`
   - **Mac/Linux**: Open Terminal → type `ifconfig` or `ip addr`

2. Edit `frontend/.env` and change the IP:
   ```
   REACT_APP_API_URL=http://192.168.1.10:4000
   ```

3. On other devices, open a browser and go to:
   ```
   http://192.168.1.10:3000
   ```

---

## Security note — LAN only

This app is built for **private use on a trusted local network** (the restaurant's own WiFi). The API token used for authentication is fetched by the browser automatically and is not hardened against a hostile network — anyone who can reach the server's IP on the LAN can reach the API.

**Do not port-forward this app to the public internet or put it behind a public domain/DDNS as-is.** If you ever need remote/internet access, that requires additional work (proper per-request authentication, restricted CORS, HTTPS) before exposing it beyond your local network.

---

## Default Login PINs

| Role    | PIN  |
|---------|------|
| Admin   | 0000 |
| Waiter  | 1111 |
| Kitchen | 2222 |

Change these in **Admin → Staff** after first login.

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
- Manual download/restore, local scheduled auto-backup, and Google Drive backup

---

## Project Structure

```
restaurant-pos/
├── backend/
│   ├── db/database.js          # sql.js (SQLite via WASM) setup and seed data
│   ├── middleware/attachIo.js  # Attaches socket.io to requests
│   ├── middleware/auth.js      # Shared-secret API token auth
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
├── uploads/                    # Food item images + logo stored here
├── backend/data/                # SQLite database file (auto-created on first run)
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Real-time | Socket.IO (WebSocket) |
| Backend | Node.js + Express |
| Database | SQLite via sql.js (pure JS/WASM — no native build step) |
| File uploads | Multer |
| HTTP client | Axios |

---

## Troubleshooting

**`Cannot find module 'socket.io'`** — The `npm install` failed silently. Delete `node_modules` folder and run `npm install` again.

**`allowedHosts` error in frontend** — Make sure the `.env` file exists in the `frontend/` folder.

**Kitchen screen not getting orders** — Edit `frontend/.env` and set `REACT_APP_API_URL` to your computer's local IP (not localhost). Then restart the frontend.

**Images not showing on other devices** — Same as above — set the IP in `.env`.

**Port already in use** — `set PORT=4001 && npm start` (Windows) or `PORT=4001 npm start` (Mac/Linux)
