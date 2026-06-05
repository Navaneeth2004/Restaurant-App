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

That's all. Node.js is a small install (~30MB) and the installer is straightforward.

> **Why Node.js?** It's the engine that runs the POS server. Think of it like Java Runtime
> or .NET Framework — a prerequisite that you install once and forget.

---

## Step 4 — Run the POS

Double-click: **`start\START_POS.bat`**

A terminal window opens showing the server is running. The browser opens automatically.
The window must stay open while using the POS. To shut down, close the window.

---

## Making it start automatically

To have the POS start when the computer turns on:

1. Right-click `start\START_POS.bat` → Create shortcut
2. Press `Win + R`, type `shell:startup`, press Enter
3. Move the shortcut into that folder

---

## Accessing from phones and tablets

All devices must be on the **same Wi-Fi network**.

The terminal window shows a "Network:" URL like `http://192.168.1.5:4000`.
Open that URL on any phone or tablet browser — no app install needed.

> **Tip for kitchen display:** Open the URL on a tablet, log in with PIN 2222 (Kitchen),
> and it stays on the kitchen screen. Use a wall-mounted tablet for best results.

---

## Setting up the easy URL (restaurant.local:4000)

By default the POS runs at `http://localhost:4000` and `http://192.168.1.x:4000`.
You can also set up a friendly URL `http://restaurant.local:4000` on the POS computer:

1. Press the **Windows key** and search for **Notepad**
2. Right-click Notepad → **Run as administrator**
3. In Notepad, click **File → Open**
4. In the address bar of the dialog, type `C:\Windows\System32\drivers\etc\` and press Enter
5. Change the file filter dropdown from `Text Documents (*.txt)` to **All Files**
6. Open the file called **hosts** (type: File — NOT the iCalendar one)
7. Scroll to the very bottom, press Enter on the last line, and add:
   ```
   127.0.0.1    restaurant.local
   ```
8. Click **File → Save**
9. Restart Chrome and go to `http://restaurant.local:4000`

> **Note:** This only works on the POS computer itself.
> For phones and tablets, use the IP address URL instead.

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
→ Check that the IP shown in the terminal matches your network
→ Try running ADD_FIREWALL_RULE.bat (right-click → Run as administrator)

**restaurant.local not working**
→ Follow the "Setting up the easy URL" section above
→ Make sure you opened Notepad as administrator before editing the hosts file
→ Restart Chrome after saving the hosts file

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