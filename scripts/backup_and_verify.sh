#!/usr/bin/env bash
set -euo pipefail

# usage: ./scripts/backup_and_verify.sh [--include-node-modules]
INCLUDE_NODE_MODULES=0
if [ "${1:-}" = "--include-node-modules" ]; then
  INCLUDE_NODE_MODULES=1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TS=$(date +%F-%H%M%S)
OUT="blocktalk-ui-backup-${TS}.tar.gz"

EXCLUDES="--exclude='.git' --exclude='*.tar.gz'"

if [ "$INCLUDE_NODE_MODULES" = "1" ]; then
  echo "Including node_modules in backup (large)..."
  tar $EXCLUDES -czvf "$OUT" .
else
  echo "Excluding node_modules for smaller backup..."
  tar $EXCLUDES --exclude='node_modules' -czvf "$OUT" .
fi

sha256sum "$OUT" > "$OUT.sha256"

echo "Backup created: $OUT"
echo "Checksum: $OUT.sha256"
ls -lh "$OUT" "$OUT.sha256"
echo "Verify with: sha256sum -c $OUT.sha256"
