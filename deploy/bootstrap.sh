#!/usr/bin/env bash
# Одноразове налаштування VM. Безпечно запускати повторно:
# GitHub Actions викликає його перед кожним деплоєм, і вже зроблені кроки пропускаються.
set -euo pipefail
APP_DIR=/opt/kumbet
DEPLOY_USER=${1:-deploy}

if ! command -v docker >/dev/null; then
  echo "→ Встановлюю Docker"
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"

# Обмежуємо логи Docker, щоб не забили диск.
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
  systemctl restart docker
fi

# e2-micro має лише 1 ГБ пам'яті — додаємо swap про всяк випадок.
if ! swapon --show | grep -q /swapfile; then
  echo "→ Створюю swap 1 ГБ"
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

command -v sqlite3 >/dev/null || { apt-get update -qq && apt-get install -y -qq sqlite3; }

mkdir -p "$APP_DIR/data" "$APP_DIR/backups"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# Щоденний бекап о 04:17.
echo "17 4 * * * $DEPLOY_USER $APP_DIR/backup.sh daily >/dev/null 2>&1" > /etc/cron.d/kumbet-backup
echo "✓ VM готова"
