#!/bin/sh
# Scheduled backups: repozo for Data.fs (incremental against the last
# full) + rsync-style blobstorage snapshot. Years of travel memories
# must survive disk failure - see README.md for the restore procedure.

set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP_DAYS="${KEEP_DAYS:-30}"
REPOZO="/app/bin/repozo"
[ -x "$REPOZO" ] || REPOZO="repozo"

# Paths default to the container layout. A native (systemd) install points
# them at the instance's var/ directory instead:
#   FILESTORAGE=/var/lib/plone/var/filestorage
#   BLOBSTORAGE=/var/lib/plone/var/blobstorage
FILESTORAGE="${FILESTORAGE:-/data/filestorage}"
BLOBSTORAGE="${BLOBSTORAGE:-/data/blobstorage}"
BACKUPS="${BACKUPS:-/backups}"

# ONESHOT=1 runs a single backup and exits, for a systemd timer that owns
# the schedule instead of the sleep loop below.
ONESHOT="${ONESHOT:-0}"

while true; do
    stamp="$(date +%Y-%m-%d_%H%M%S)"
    echo "[backup] $stamp starting"

    mkdir -p "$BACKUPS/filestorage" "$BACKUPS/blobstorage"

    # Incremental repozo backup (falls back to full when none exists);
    # --gzip keeps years of dailies small.
    "$REPOZO" --backup --gzip \
        --repository "$BACKUPS/filestorage" \
        --file "$FILESTORAGE/Data.fs"

    # Blobstorage snapshot: hardlink-copy against the previous snapshot
    # so unchanged blobs cost no space (rsync --link-dest pattern; cp -al
    # is the busybox-compatible equivalent baseline).
    if command -v rsync >/dev/null 2>&1; then
        latest_link="$BACKUPS/blobstorage/latest"
        rsync -a --delete \
            ${latest_link:+--link-dest="$latest_link"} \
            "$BLOBSTORAGE/" "$BACKUPS/blobstorage/$stamp/"
        ln -sfn "$BACKUPS/blobstorage/$stamp" "$latest_link"
    else
        cp -a "$BLOBSTORAGE" "$BACKUPS/blobstorage/$stamp"
    fi

    # Prune old blob snapshots + repozo deltas beyond the retention window.
    find "$BACKUPS/blobstorage" -maxdepth 1 -type d -mtime "+$KEEP_DAYS" \
        -exec rm -rf {} + 2>/dev/null || true
    "$REPOZO" --backup --gzip --repository "$BACKUPS/filestorage" \
        --file "$FILESTORAGE/Data.fs" --kill-old-on-full >/dev/null 2>&1 || true

    [ "$ONESHOT" = "1" ] && { echo "[backup] $stamp done"; exit 0; }

    echo "[backup] $stamp done; sleeping ${INTERVAL}s"
    sleep "$INTERVAL"
done
