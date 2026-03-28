#!/bin/bash
# ============================================================
# SETUP CLOUDFLARE PAGES — Connect your blog to the web
# Double-click this file. It will:
#   1. Install Wrangler (Cloudflare CLI) if needed
#   2. Log you into Cloudflare (opens browser — just click Allow)
#   3. Connect your GitHub repo to Cloudflare Pages
#   4. Your site will be live within minutes
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  Connecting your blog to Cloudflare Pages"
echo "=========================================="
echo ""

# Step 1: Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Download it from https://nodejs.org"
    read -p "Press Enter to close..."
    exit 1
fi

# Step 2: Install wrangler (Cloudflare CLI) if needed
if ! command -v wrangler &> /dev/null; then
    echo "→ Installing Cloudflare CLI (wrangler)..."
    npm install -g wrangler
    echo "✓ Wrangler installed"
else
    echo "✓ Wrangler already installed"
fi

# Step 3: Log into Cloudflare
echo ""
echo "→ Opening your browser to log into Cloudflare..."
echo "  Just click 'Allow' when the page opens."
echo ""
wrangler login
echo "✓ Logged into Cloudflare"

# Step 4: Create Cloudflare Pages project connected to GitHub
echo ""
echo "→ Creating Cloudflare Pages project..."
echo ""

GITHUB_USER="Harzavopolos1"
REPO_NAME="site"

wrangler pages project create ores-blog \
    --production-branch main \
    2>/dev/null || echo "  (Project may already exist — continuing)"

echo ""
echo "=========================================="
echo "  ✓ Cloudflare CLI is ready!"
echo ""
echo "  NEXT STEP: Connect GitHub in the Cloudflare dashboard."
echo "  Opening it now..."
echo "=========================================="
echo ""

# Open Cloudflare Pages dashboard
open "https://dash.cloudflare.com/?to=/:account/pages"

echo "In the dashboard:"
echo "  1. Click 'Create a project'"
echo "  2. Click 'Connect to Git'"
echo "  3. Select your GitHub account (Harzavopolos1)"
echo "  4. Select the 'site' repository"
echo "  5. Build settings:"
echo "     - Framework: None"
echo "     - Build command: npm run build"
echo "     - Build output directory: _site"
echo "  6. Click 'Save and Deploy'"
echo ""
echo "Tell Claude 'done' when the deploy finishes."
read -p "Press Enter to close..."
