#!/usr/bin/env bash
set -e

echo "========================================================="
echo "   The Helping Squad - Document Vault Standalone Installer"
echo "========================================================="
echo ""

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js (version 18 or newer) from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "[1/4] Detected Node.js: $NODE_VERSION"
echo ""

echo "[2/4] Installing application dependencies..."
npm install
echo "Dependencies ready!"
echo ""

echo "[3/4] Creating Desktop Shortcut..."
DESKTOP_DIR="$HOME/Desktop"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(uname)" = "Darwin" ]; then
    # macOS Launcher Script
    LAUNCHER="$DESKTOP_DIR/The Helping Squad Vault.command"
    cat << 'EOF' > "$LAUNCHER"
#!/bin/bash
cd "$(dirname "$0")" || exit
open http://localhost:3000
npm start
EOF
    chmod +x "$LAUNCHER"
    echo "Created macOS desktop launcher: $LAUNCHER"
else
    # Linux Desktop Entry
    DESKTOP_FILE="$DESKTOP_DIR/helping-squad-vault.desktop"
    cat << EOF > "$DESKTOP_FILE"
[Desktop Entry]
Version=1.0
Type=Application
Name=The Helping Squad Vault
Comment=Secure View-Only PDF Vault
Exec=sh -c "cd '$SCRIPT_DIR' && xdg-open http://localhost:3000 && npm start"
Icon=$SCRIPT_DIR/public/pwa-192x192.png
Terminal=true
Categories=Office;Security;
EOF
    chmod +x "$DESKTOP_FILE"
    echo "Created Linux desktop entry: $DESKTOP_FILE"
fi

echo ""
echo "[4/4] Starting Vault Server..."
echo "Opening http://localhost:3000 in your browser..."

if [ "$(uname)" = "Darwin" ]; then
    open http://localhost:3000 || true
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000 || true
fi

npm start
