#!/bin/sh
# Pulls the repository and rebuilds the container when something changed.
# Run as root (docker); git runs as the owner of the checkout.
#   cron: 0 3 * * 0  /home/teslamate/zpevnik/web-app/update.sh >> /var/log/zpevnik-update.log 2>&1
#   ./update.sh --force   rebuild even without new commits
#
# Server checkout: partial clone with only songs/ and web-app/ (skips images and history blobs):
#   git clone --filter=blob:none --sparse https://github.com/sanovada/Zpevnik.git ~/zpevnik
#   cd ~/zpevnik && git sparse-checkout set songs web-app
# Server-only settings (ports, networks) go to web-app/docker-compose.override.yml (not in git).
set -eu
# cron runs with PATH=/usr/bin:/bin, runuser lives in sbin
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
cd "$(dirname "$0")/.."

owner=$(stat -c %U .)
g() { runuser -u "$owner" -- git "$@"; }

old=$(g rev-parse HEAD)
g pull --ff-only -q
new=$(g rev-parse HEAD)

if [ "$old" = "$new" ] && [ "${1:-}" != "--force" ]; then
    echo "$(date -Is) no changes ($new)"
    exit 0
fi

cd web-app
docker compose up -d --build
docker image prune -f >/dev/null
echo "$(date -Is) deployed $old -> $new"
