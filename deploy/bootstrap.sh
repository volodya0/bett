#!/usr/bin/env bash
# One-time VM setup. Idempotent: GitHub Actions runs it before every deploy
# and steps that are already done are skipped.
set -euo pipefail
APP_DIR=/opt/kumbet
DEPLOY_USER=${1:-deploy}

if ! command -v docker >/dev/null; then
  echo "→ Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"

# Cap Docker logs so they don't fill the disk.
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
  systemctl restart docker
fi

# e2-micro has only 1 GB of RAM — add swap just in case.
if ! swapon --show | grep -q /swapfile; then
  echo "→ Creating 1 GB swap"
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

command -v sqlite3 >/dev/null || { apt-get update -qq && apt-get install -y -qq sqlite3; }

mkdir -p "$APP_DIR/backups"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# Daily backup at 04:17.
echo "17 4 * * * $DEPLOY_USER $APP_DIR/backup.sh daily >/dev/null 2>&1" > /etc/cron.d/kumbet-backup
echo "✓ VM is ready"
