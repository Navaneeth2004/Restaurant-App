#!/bin/bash
# Build Restaurant POS for deployment
# Run this on YOUR computer (developer machine), not the restaurant computer.
# After this runs, the folder is ready to copy to the restaurant PC.

set -e
clear
echo ""
echo " =========================================="
echo "   Building Restaurant POS for deployment"
echo "   Run this on YOUR computer, not the"
echo "   restaurant computer."
echo " =========================================="
echo ""

APP_ROOT="$(cd "$(dirname "$0")/../" && pwd)"
cd "$APP_ROOT"

# Check Node
if ! command -v node &> /dev/null; then
    echo " [ERROR] Node.js not installed. Install from https://nodejs.org (LTS)"
    exit 1
fi
NODE_VER=$(node -v)
echo " [OK] Node.js $NODE_VER"

# Backend
echo " [1/3] Installing backend dependencies..."
cd backend && npm install >/dev/null 2>&1 && cd ..
echo " [OK] Backend ready"

# Frontend
echo " [2/3] Installing frontend dependencies..."
cd frontend
[ ! -d "node_modules" ] && npm install --legacy-peer-deps >/dev/null 2>&1

echo " [3/3] Building frontend (takes 1-2 minutes)..."
npm run build >/dev/null 2>&1
cd ..
echo " [OK] Frontend built"

echo ""
echo " =========================================="
echo ""
echo "  BUILD COMPLETE!"
echo ""
echo "  Copy the entire restaurant-pos folder"
echo "  to the restaurant computer and run:"
echo ""
echo "    bash start/START_POS.sh"
echo ""
echo "  The restaurant computer only needs"
echo "  Node.js installed (nothing else)."
echo "  No npm install, no build step needed."
echo ""
echo " =========================================="
echo ""
