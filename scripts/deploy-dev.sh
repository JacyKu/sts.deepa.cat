#!/usr/bin/env bash
# Deploy the STS dev environment (dev.deepa.cat).
#
# Run on the server as the app user:
#   bash scripts/deploy-dev.sh
#
# Assumes:
#   - a checkout of JacyKu/sts.deepa.cat at /root/sts-dev (default; override
#     with STS_DEV_DIR) with the `dev` branch checked out
#   - /root/sts-dev/.env containing the dev environment variables
#     (STS_PUBLIC_BASE_URL=https://dev.deepa.cat, STS_SESSION_SECRET,
#     STS_DISCORD_CLIENT_ID, STS_DISCORD_CLIENT_SECRET)
#   - a PM2 app named `sts-dev` (see ecosystem.config.cjs in deepa.cat)
#   - nginx routing dev.deepa.cat -> 127.0.0.1:6679 (see nginx.conf)
#
# The dev checkout keeps its own SQLite database (data/sts-builds.db), so
# dev builds/favourites never touch production data.

set -euo pipefail

REPO_DIR="${STS_DEV_DIR:-/root/sts-dev}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
    echo "Cloning sts.deepa.cat into $REPO_DIR"
    git clone https://github.com/JacyKu/sts.deepa.cat.git "$REPO_DIR"
fi

cd "$REPO_DIR"

git fetch --all --quiet

# The dev branch appears on origin after the first sync run; fall back to
# origin/main until then.
if git show-ref --verify --quiet refs/remotes/origin/dev; then
    git checkout dev --quiet
    git reset --hard --quiet origin/dev
else
    echo "origin/dev not found yet - deploying origin/main (run the sync workflow first)"
    git checkout main --quiet
    git reset --hard --quiet origin/main
fi

if [[ ! -f .env ]]; then
    echo "ERROR: $REPO_DIR/.env is missing (see .env.example in the repo)." >&2
    exit 1
fi

npm install --silent
npm run build

pm2 restart sts-dev --update-env 2>/dev/null || \
    pm2 start node_modules/next/dist/bin/next --name sts-dev -- start -p 6679

echo "dev.deepa.cat deployed from origin/dev ($(git rev-parse --short HEAD))"
