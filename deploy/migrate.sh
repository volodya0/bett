#!/usr/bin/env bash
# One-time move from the single-copy layout (/opt/kumbet/data) to prod + test.
# The existing database becomes the TEST one; prod starts empty.
# Idempotent: does nothing once /opt/kumbet/test/data exists.
set -euo pipefail
DIR=/opt/kumbet
cd "$DIR"
if [ -d data ] && [ ! -d test/data ]; then
  echo "→ Moving the existing database to the test copy"
  docker ps -q --filter label=com.docker.compose.project=kumbet --filter label=com.docker.compose.service=app | xargs -r docker stop
  mkdir -p backups test
  if [ -f data/kumbet.db ]; then
    sqlite3 data/kumbet.db ".backup 'backups/single-$(date +%Y%m%d-%H%M%S)-premigrate.db'"
  fi
  sudo mv data test/data
fi
mkdir -p test/data prod/data backups
sudo chown "$(id -u):$(id -g)" test prod
