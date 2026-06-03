#!/bin/bash

# Restaurant APP — One-Click Launcher (Mac/Linux)
# Double-click or run: bash START_POS.sh

clear
echo ""
echo " =========================================="
echo "   Restaurant APP — Starting up..."
echo " =========================================="
echo ""

# ── Kill any process on port 4000 ──────────────────────────────────────────
echo " [CLEANUP] Clearing port 4000..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    lsof -ti:4000 | xargs kill -9 2>/dev/null || true
else
    fuser -k 4000/tcp 2>/dev/null || true
fi
sleep 1

# ── Check Node.js ─────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo " [ERROR] Node.js not installed"
    echo " Install from: https://nodejs.org (LTS)"
    exit 1
fi

NODE_VER=$(node -v)
echo " [OK] Node.js $NODE_VER"

# ── Setup ──────────────────────────────────────────────────────────────────
APP_ROOT="$(cd "$(dirname "$0")/../" && pwd)"
cd "$APP_ROOT"

if [ ! -d "backend/node_modules" ]; then
    echo " [SETUP] Backend packages..."
    cd backend && npm install >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo " [ERROR] Backend install failed"
        exit 1
    fi
    cd ..
fi

if [ ! -d "frontend/build" ]; then
    echo " [SETUP] Frontend build..."
    cd frontend
    [ ! -d "node_modules" ] && npm install >/dev/null 2>&1
    npm run build >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo " [ERROR] Frontend build failed"
        exit 1
    fi
    cd ..
fi

echo " [OK] All ready"
echo ""

# ── Get IP ────────────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
else
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
fi

# ── Start server ───────────────────────────────────────────────────────────
echo " [START] Server starting..."
cd "$APP_ROOT/backend"
node server.js &
SERVER_PID=$!
cd "$APP_ROOT"

sleep 2

# ── Open browser ───────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:4000" &>/dev/null || true
else
    xdg-open "http://localhost:4000" &>/dev/null || true
fi

echo ""
echo " =========================================="
echo ""
echo "  ✓ POS is running!"
echo ""
echo "  Local:   http://localhost:4000"
echo "  Network: http://$LOCAL_IP:4000"
echo ""
echo " =========================================="
echo ""

# Keep running
wait $SERVER_PID
