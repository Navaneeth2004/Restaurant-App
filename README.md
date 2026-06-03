# ABC Chicken — Restaurant POS

A full-stack Point of Sale system with real-time kitchen display, order management, and admin panel.

---

## Requirements

- **Node.js v18 or v20** — https://nodejs.org (use the LTS version — v22 has a known issue with react-scripts)
- A modern browser (Chrome recommended for kitchen display)
- All devices must be on the **same Wi-Fi network**

> **Windows users:** If you get a `better-sqlite3` error during install, see the fix below.

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

---

### Step 1b — Windows fix for `better-sqlite3`

If you see this error during `npm install` in the backend:
```
gyp ERR! find VS You need to install the latest version of Visual Studio
```

Run this command instead to install the prebuilt Windows binary:

```bash
cd backend
npm install --ignore-scripts
npm install better-sqlite3 --build-from-source=false
```

If that still fails, run this one-liner to install the Windows C++ build tools (only needed once):
```bash
npm install --global windows-build-tools
```
Then re-run `npm install` in the backend folder.

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
- Live timer on each order — turns red after 15 minutes
- Sound chime on every new order (Web Audio, no files needed)
- "Mark as Delivered" closes the order from kitchen

### Admin Panel
- **Restaurant**: name, address, bill footer, currency, tax %, brand color
- **Tables**: add/delete/edit tables with seat count
- **Menu Items**: add/edit/delete with image upload, description, price, category, availability toggle
- **Categories**: add/rename/delete menu categories
- **Staff**: add/remove staff with PIN and role
- Admin can access all views (Waiter, Kitchen, Reports, Admin)

### Reports
- Today's revenue, order count, active orders, occupied tables
- 30-day revenue bar chart
- Top selling items today
- Full order history with date filter

---

## Project Structure

```
restaurant-pos/
├── backend/
│   ├── db/database.js          # SQLite setup and seed data
│   ├── middleware/attachIo.js  # Attaches socket.io to requests
│   ├── routes/
│   │   ├── settings.js
│   │   ├── categories.js
│   │   ├── menu.js             # Includes image upload (multer)
│   │   ├── tables.js
│   │   ├── orders.js
│   │   ├── staff.js
│   │   └── reports.js
│   ├── server.js               # Express + Socket.IO entry point
│   └── package.json
│
├── frontend/
│   ├── .env                    # API URL config — edit this for your IP
│   └── src/
│       ├── components/         # Shared UI (LoginScreen, TopBar, BillModal)
│       ├── context/            # Auth, Toast, Settings providers
│       ├── hooks/              # useSocket, useTimer
│       ├── services/           # api.js, socket.js
│       ├── utils/sound.js      # Kitchen chime (Web Audio)
│       └── views/              # WaiterView, KitchenView, AdminView, ReportsView
│           └── admin/          # Admin sub-tabs
│
├── uploads/                    # Food item images stored here
├── data/                       # SQLite database (auto-created on first run)
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Real-time | Socket.IO (WebSocket) |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 |
| File uploads | Multer 2 |
| HTTP client | Axios |

---

## Troubleshooting

**`Cannot find module 'socket.io'`** — The `npm install` failed silently. Delete `node_modules` folder and run `npm install` again.

**`allowedHosts` error in frontend** — Make sure the `.env` file exists in the `frontend/` folder.

**Kitchen screen not getting orders** — Edit `frontend/.env` and set `REACT_APP_API_URL` to your computer's local IP (not localhost). Then restart the frontend.

**Images not showing on other devices** — Same as above — set the IP in `.env`.

**Port already in use** — `set PORT=4001 && npm start` (Windows) or `PORT=4001 npm start` (Mac/Linux)
