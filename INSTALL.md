# Installation Guide

## Prerequisites

- **Node.js v18 or v20** (NOT v22) — Download from https://nodejs.org and choose the "LTS" version
  - v22 causes a known `ajv/dist/compile/codegen` error with react-scripts 5
  - If you already have v22: install nvm-windows to switch versions, or downgrade

## Quick Install

### Step 1 — Backend

```
cd restaurant-pos\backend
npm install
npm start
```

You should see the startup banner. Keep this terminal open.

### Step 2 — Frontend (new terminal)

```
cd restaurant-pos\frontend
npm install --legacy-peer-deps
npm start
```

Opens at http://localhost:3000

---

## If you get errors

### "Cannot find module 'ajv/dist/compile/codegen'"
**Cause:** Node.js v22 is incompatible with react-scripts 5.

**Fix — Option A (recommended):** Downgrade Node.js to v20 LTS from nodejs.org

**Fix — Option B:** Run these commands in the frontend folder:
```
npm install ajv@^8.0.0 --legacy-peer-deps
npm start
```

### "better-sqlite3" / "node-gyp" errors on Windows
Run in the backend folder:
```
npm install --ignore-scripts
npm rebuild better-sqlite3 --build-from-source=false
```
If that fails, install build tools (run as Administrator):
```
npm install --global windows-build-tools
```
Then retry `npm install` in backend.

### Frontend shows blank screen / "Failed to load data"
The backend must be running first. Check the backend terminal for errors.

---

## Accessing from phone / kitchen tablet

1. Find your PC's local IP:
   - Windows: Open CMD → type `ipconfig` → note "IPv4 Address" (e.g. 192.168.1.50)

2. Edit `frontend\.env`:
   ```
   REACT_APP_API_URL=http://192.168.1.50:4000
   ```

3. Restart the frontend (`npm start`)

4. On phone/tablet: open browser → go to `http://192.168.1.50:3000`

---

## Default Login PINs

| Role    | PIN  |
|---------|------|
| Admin   | 0000 |
| Waiter  | 1111 |
| Kitchen | 2222 |

Change these in Admin → Staff after logging in.
