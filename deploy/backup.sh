#!/usr/bin/env bash
# Consistent SQLite backup (safe while the app is running).
set -euo pipefail
DIR=/opt/kumbet
DB=$DIR/data/kumbet.db
[ -f "$DB" ] || exit 0
NAME="$DIR/backups/kumbet-$(date +%Y%m%d-%H%M%S)-${1:-manual}.db"
sqlite3 "$DB" ".backup '$NAME'"
gzip "$NAME"
# Keep 30 days.
find "$DIR/backups" -name 'kumbet-*.db.gz' -mtime +30 -delete
echo "✓ Backup: $NAME.gz"
