#!/usr/bin/env bash
# Безпечна копія SQLite-бази (працює і поки апка запущена).
set -euo pipefail
DIR=/opt/kumbet
DB=$DIR/data/kumbet.db
[ -f "$DB" ] || exit 0
NAME="$DIR/backups/kumbet-$(date +%Y%m%d-%H%M%S)-${1:-manual}.db"
sqlite3 "$DB" ".backup '$NAME'"
gzip "$NAME"
# Зберігаємо 30 днів.
find "$DIR/backups" -name 'kumbet-*.db.gz' -mtime +30 -delete
echo "✓ Бекап: $NAME.gz"
