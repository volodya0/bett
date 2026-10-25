#!/usr/bin/env bash
# Consistent SQLite backups of the prod and test databases (safe while running).
# Usage: backup.sh [label] [prod|test]   — without an env both are backed up.
set -euo pipefail
DIR=/opt/kumbet
LABEL=${1:-manual}
mkdir -p "$DIR/backups"
for ENV in ${2:-prod test}; do
  DB=$DIR/$ENV/data/kumbet.db
  [ -f "$DB" ] || continue
  NAME="$DIR/backups/$ENV-$(date +%Y%m%d-%H%M%S)-$LABEL.db"
  sqlite3 "$DB" ".backup '$NAME'"
  gzip "$NAME"
  echo "✓ Backup: $NAME.gz"
done
# Keep 30 days.
find "$DIR/backups" -name '*.db.gz' -mtime +30 -delete
