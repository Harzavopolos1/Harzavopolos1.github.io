#!/bin/bash
# ============================================================
# SETUP GITHUB — Works from Google Drive (no lock file issues)
# Copies files to /tmp, pushes from there.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GH_BIN="$SCRIPT_DIR/.tools/gh"
TEMP_DIR="/tmp/site-deploy"

echo ""
echo "=========================================="
echo "  Setting up GitHub for your blog"
echo "=========================================="
echo ""

# ------- Check gh exists -------
if [ ! -f "$GH_BIN" ]; then
    echo "ERROR: GitHub CLI not found. Run setup_github.command first."
    read -p "Press Enter to close..."
    exit 1
fi

# ------- Check login -------
if ! "$GH_BIN" auth status &> /dev/null 2>&1; then
    echo "→ Need to log in to GitHub..."
    "$GH_BIN" auth login --web --git-protocol https
fi

GH_USER=$("$GH_BIN" api user --jq '.login')
echo "✓ Logged in as: $GH_USER"

# ------- Create repo on GitHub (API only, no git needed) -------
if "$GH_BIN" repo view "$GH_USER/site" &> /dev/null 2>&1; then
    echo "✓ GitHub repo already exists"
else
    echo "→ Creating repo on GitHub..."
    "$GH_BIN" repo create site --private
    echo "✓ Repo created"
fi

# ------- Copy files to temp (outside Google Drive) -------
echo "→ Preparing files..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy only source files (not node_modules, _site, .git, .tools)
rsync -a --exclude='node_modules' --exclude='_site' --exclude='.git' --exclude='.tools' --exclude='.DS_Store' "$SCRIPT_DIR/" "$TEMP_DIR/"

cd "$TEMP_DIR"

# ------- Git init and push from temp -------
git init -b main
git config user.email "orne71@gmail.com"
git config user.name "Ore"
git add -A
git commit -m "Initial commit: Ore's blog — Eleventy site with charcoal monochrome design"

# Setup credential helper for gh
"$GH_BIN" auth setup-git

git remote add origin "https://github.com/$GH_USER/site.git"
echo "→ Pushing to GitHub..."
git push -u origin main

echo ""
echo "=========================================="
echo "  ✓ DONE! Your blog is on GitHub."
echo "  https://github.com/$GH_USER/site"
echo "=========================================="
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "Tell Claude 'done'"
read -p "Press Enter to close..."
