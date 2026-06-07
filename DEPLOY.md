# Deploying the POS to the Restaurant

## Overview

The app has two parts: a **backend** (Node.js server) and a **frontend** (React web app).
The frontend needs to be *built* into static files before deployment. Once built, you only
need Node.js on the restaurant computer — no npm, no compiling, no internet required to run.

---

## Step 1 — Build on YOUR computer (one time)

On your dev machine, run one of these:

**Windows:**
```
double-click: start\BUILD_FOR_RESTAURANT.bat
```

**Mac/Linux:**
```bash
bash start/BUILD_FOR_RESTAURANT.sh
```

This installs all dependencies and compiles the frontend into `frontend/build/`.
It takes about 2 minutes. After this, the folder is self-contained.

---

## Step 2 — Copy the folder to the restaurant computer

Copy the entire `restaurant-pos` folder to the restaurant PC.
You can use a USB drive, Google Drive, or any file transfer method.

**What you need on the restaurant computer:**
- The `restaurant-pos` folder (with `frontend/build/` inside it)
- Node.js installed (see below)

**What you do NOT need:**
- npm install (already done)
- Any build step
- Internet connection (after first setup)

---

## Step 3 — Install Node.js on the restaurant computer (one time)

1. Go to **https://nodejs.org** on the restaurant computer
2. Download the **LTS** version (e.g. v20 or v22)
3. Run the installer — just click Next, Next, Next
4. Restart the computer

---

## Step 4 — Run the POS

Double-click: **`start\START_POS.bat`**

A terminal window opens showing the server is running. The browser opens automatically.
The window must stay open while using the POS. To shut down, close the window.

---

## Step 5 — Fix the IP address so phones always connect ⚠️

By default your PC gets a different IP address from the router every time it restarts,
which means the URL you bookmark on phones stops working. **Do this once to make it permanent.**

### Option A — Set static IP on the PC (recommended, no router login needed)

1. Open **Start** → search **"View network connections"** → press Enter
2. Right-click your **Wi-Fi** (or Ethernet) adapter → **Properties**
3. Double-click **Internet Protocol Version 4 (TCP/IPv4)**
4. Select **"Use the following IP address"** and enter:
   - IP address: *(use the IP shown in the POS server window, e.g. `192.168.1.43`)*
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1`
   - Preferred DNS: `8.8.8.8`
   - Alternate DNS: `8.8.4.4`
5. Click **OK** → **OK**

> **Note:** If you ever take this PC to a different network (e.g. home vs restaurant),
> you may need to temporarily switch back to "Obtain an IP address automatically".

### Option B — DHCP reservation on the router (cleanest, needs router login)

1. Open **http://192.168.1.1** in your browser
   *(if that doesn't work, run `ipconfig` in CMD and look for "Default Gateway")*
2. Log in — credentials are on the sticker on the back/bottom of your router
3. Find **DHCP Reservation** / **Static Lease** / **Address Reservation**
4. Find your PC in the list and assign it a fixed IP (e.g. `192.168.1.43`)
5. Save and restart the router

---

## Accessing from phones and tablets

All devices must be on the **same Wi-Fi network** as the POS computer.

The terminal window shows a "Network:" URL like `http://192.168.1.43:4000`.
Open that URL on any phone or tablet browser — no app install needed.

**Bookmark it / add to home screen for one-tap access:**
- **Android (Chrome):** tap the 3-dot menu → "Add to Home screen"
- **iPhone (Safari):** tap the Share button → "Add to Home Screen"

> `restaurant.local:4000` works on the POS PC itself but **not** on Android phones —
> use the IP address URL on all phones and tablets.

---

## Making it start automatically

To have the POS start when the computer turns on:

1. Right-click `start\START_POS.bat` → Create shortcut
2. Press `Win + R`, type `shell:startup`, press Enter
3. Move the shortcut into that folder

---

## Troubleshooting

**"Node.js is not installed" error**
→ Install Node.js from nodejs.org (LTS version)

**Port 4000 already in use**
→ Restart the computer, then run START_POS.bat again

**Browser doesn't open automatically**
→ Manually open Chrome and go to http://localhost:4000

**Phone can't connect**
→ Make sure phone is on the same Wi-Fi as the POS computer
→ The IP shown in the terminal is the correct URL — use that, not restaurant.local
→ If still blocked, run `start\ADD_FIREWALL_RULE.bat` (right-click → Run as administrator)

**IP address changed and phone bookmark stopped working**
→ Follow Step 5 above to make the IP permanent

**Data lost after restart**
→ Data is in `backend/data/restaurant.db` — this file persists across restarts
→ Back it up periodically by copying it to a USB drive

---

## Updating the app

When you release a new version:

1. On your dev machine: make changes, run `BUILD_FOR_RESTAURANT.bat`
2. Copy the updated folder to the restaurant computer (replace the old one)
3. Keep the `backend/data/` folder from the old installation — it has the restaurant's data

---

## Default Login PINs

| Role    | PIN  |
|---------|------|
| Admin   | 0000 |
| Waiter  | 1111 |
| Kitchen | 2222 |

Change these in **Admin → Staff** after first login.