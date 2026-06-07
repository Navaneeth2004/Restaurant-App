#!/bin/bash
# Restaurant POS — Update from GitHub (Mac / Linux)
# Run this script to pull the latest version and rebuild.

set -e
clear
echo ""
echo " =========================================="
echo "   Restaurant POS — Update from GitHub"
echo " =========================================="
echo ""
echo "  This will download the latest version from"
echo "  GitHub and rebuild the app."
echo ""
echo "  Your data (menu, orders, staff) is stored"
echo "  in backend/data/ and will NOT be touched."
echo ""
read -p "  Continue? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "  Update cancelled."
    exit 0
fi

APP_ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
cd "$APP_ROOT"

echo ""

# ── 1. Check git ──────────────────────────────────────────────────────────
if ! command -v git &> /dev/null; then
    echo " [ERROR] Git not installed."
    echo "         Install: https://git-scm.com  (Mac: brew install git)"
    exit 1
fi
echo " [OK] Git found"

# ── 2. Backup data ────────────────────────────────────────────────────────
if [ -d "$APP_ROOT/backend/data" ]; then
    BACKUP_DIR="$APP_ROOT/backups/data_$(date +%Y-%m-%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$APP_ROOT/backend/data/." "$BACKUP_DIR/"
    echo " [OK] Data backed up to $BACKUP_DIR"
else
    echo " [INFO] No data folder yet — nothing to backup"
fi

# ── 3. Pull latest code ───────────────────────────────────────────────────
echo " [3/5] Pulling latest code from GitHub..."
if ! git pull origin main 2>/dev/null; then
    if ! git pull origin master 2>/dev/null; then
        echo " [ERROR] Git pull failed."
        echo "         Check your internet connection."
        exit 1
    fi
fi
echo " [OK] Code updated"

# ── 4. Backend packages ───────────────────────────────────────────────────
echo " [4/5] Installing backend packages..."
cd "$APP_ROOT/backend"
npm install >/dev/null 2>&1
echo " [OK] Backend packages ready"

# ── 5. Rebuild frontend ───────────────────────────────────────────────────
echo " [5/5] Building frontend..."
cd "$APP_ROOT/frontend"
rm -rf build
npm install --legacy-peer-deps >/dev/null 2>&1
npm run build >/dev/null 2>&1
echo " [OK] Frontend built"

echo ""
echo " =========================================="
echo ""
echo "  UPDATE COMPLETE!"
echo ""
echo "  Run:  bash start/START_POS.sh"
echo "  to launch the updated app."
echo ""
echo "  Your data is safe in backend/data/"
if [ -d "$APP_ROOT/backups" ]; then
    echo "  Backup saved to $BACKUP_DIR"
fi
echo ""
echo " =========================================="
echo ""