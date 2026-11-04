# Restaurant POS

A point-of-sale system for restaurants: waiters take orders on a phone, the kitchen sees them live,
customers can order from a table QR code, and the owner gets bills, reports and GST exports.
One server can run many restaurants; each restaurant's data is kept completely separate.

## What it does

**Waiter** — pick a table or a parcel slot, add items with notes, send to the kitchen (several devices can add to
the same table safely), cancel items or rounds, generate the bill, take payment (cash, UPI, card, cheque, split).

**Kitchen** — live order cards with timers that turn red when overdue, a sound for new orders, additions and
cancellations, and "Mark Delivered".

**Customer (QR)** — scan the table's QR, browse the menu, order, watch each round go from "In kitchen" to "Ready",
and request the bill. No login.

**Admin** — floor view, restaurant details and GST settings, tables, menu with photos, categories, staff and PINs,
linked devices, an optional admin-PIN lock for sensitive areas.

**Reports and exports** — today's analytics, visit history (edit payment, reprint, delete with an audit trail),
GSTR-1 / GSTR-3B / GSTR-9, and a Revenue export (Excel-friendly CSV and JSON).

**Backup** — download or restore a restaurant as a zip.  **Support** — staff send tickets with diagnostics.

**Root console** (`/root`) — for the person running the service: create, suspend, edit and delete restaurants,
set plans and limits, reset owner passwords, read support tickets, see the audit log.

## How people sign in

1. **The device is linked once.** The owner logs in with phone + password, or staff type a 6-digit code an admin
   made under Admin → Devices. Codes last 10 minutes and work once.
2. **Each person enters their own PIN.** PINs are 4–6 digits, stored hashed, and a wrong-PIN lockout applies.

A new restaurant chooses its first admin PIN at sign-up. There are no default PINs.

## Requirements

- Node.js 18 or newer
- A modern browser (Chrome recommended for the kitchen screen)
- For a real deployment: a server with persistent disk and HTTPS (see [DEPLOY.md](DEPLOY.md))

The database is SQLite through `better-sqlite3`, which ships ready-made binaries for common systems. If npm cannot
download one for your machine, install the C++ build tools (Visual Studio Build Tools on Windows,
`build-essential` on Linux) and run `npm install` again.

## Try it on your computer

```bash
# 1. Install
cd backend  && npm install
cd ../frontend && npm install

# 2. Configure the backend
cd ../backend
cp .env.example .env
#    for local testing over plain HTTP, set in .env:
#      NODE_ENV=development
#      COOKIE_SECURE=false
#      DATA_DIR=./data

# 3. Start the backend (port 4000)
npm start

# 4. In a second terminal, start the frontend (port 3000)
cd ../frontend && npm start
```

Open http://localhost:3000, choose **New restaurant? Create an account**, and sign in with the PIN you chose.
Keep `REACT_APP_API_URL` empty: the dev server forwards `/api` and live updates to the backend, so cookies stay on
one origin. To test from a phone, open the frontend's network address (for example `http://192.168.1.20:3000`).

## Checks

```bash
cd backend  && npm test                       # end-to-end API tests on a throw-away data folder
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

## Folders

```
restaurant-pos/
├── backend/
│   ├── server.js            boot only
│   ├── src/                 routes → services → repositories → SQLite (see backend/ARCHITECTURE.md)
│   ├── scripts/             admin.js (support commands), import-legacy.js
│   ├── tests/               end-to-end tests
│   ├── .env.example         every setting, explained
│   └── data/                created at run time: accounts.db, tenants/, files/, tickets/   (not in git)
├── frontend/
│   ├── src/                 React app (see frontend/ARCHITECTURE.md)
│   └── build/               created by `npm run build`; the backend serves it           (not in git)
├── DEPLOY.md
├── LICENSE.txt
└── README.md
```

Where data lives: `DATA_DIR/accounts.db` (owners, restaurants, devices), `DATA_DIR/tenants/<id>.db` (one database per
restaurant), `DATA_DIR/files/<id>/uploads/` (menu photos and logo), `DATA_DIR/tickets/` (ticket screenshots).
**Back up the whole `DATA_DIR`.**

## Tech

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Live updates | Socket.IO |
| Backend | Node.js, Express |
| Database | SQLite (`better-sqlite3`), one file per restaurant |
| Uploads | Multer (JPG, PNG, WEBP, GIF only) |

## Troubleshooting

- **`Cannot find module …`** — delete `node_modules` and run `npm install` again in that folder.
- **Blank page or login loops on `http://`** — set `COOKIE_SECURE=false` in `backend/.env` (local testing only).
- **Phone cannot connect in development** — use the frontend's network address, and allow port 3000 through the
  computer's firewall.
- **Photos missing after moving data** — copy `DATA_DIR/files` together with the databases.
- **Port already in use** — set `PORT=4001` in `backend/.env` (and `POS_BACKEND_URL=http://localhost:4001` for the
  frontend dev server).

## License

Proprietary. See [LICENSE.txt](LICENSE.txt).