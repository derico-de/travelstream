#!/bin/sh
# Scheduled backups: repozo for Data.fs (incremental against the last
# full) + rsync-style blobstorage snapshot. Years of travel memories
# must survive disk failure - see README.md for the restore procedure.

set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP_DAYS="${KEEP_DAYS:-30}"
REPOZO="/app/bin/repozo"
[ -x "$REPOZO" ] || REPOZO="repozo"

while true; do
    stamp="$(date +%Y-%m-%d_%H%M%S)"
    echo "[backup] $stamp starting"

    mkdir -p /backups/filestorage /backups/blobstorage

    # Incremental repozo backup (falls back to full when none exists);
    # --gzip keeps years of dailies small.
    "$REPOZO" --backup --gzip \
        --repository /backups/filestorage \
        --file /data/filestorage/Data.fs

    # Blobstorage snapshot: hardlink-copy against the previous snapshot
    # so unchanged blobs cost no space (rsync --link-dest pattern; cp -al
    # is the busybox-compatible equivalent baseline).
    if command -v rsync >/dev/null 2>&1; then
        latest_link="/backups/blobstorage/latest"
        rsync -a --delete \
            ${latest_link:+--link-dest="$latest_link"} \
            /data/blobstorage/ "/backups/blobstorage/$stamp/"
        ln -sfn "/backups/blobstorage/$stamp" "$latest_link"
    else
        cp -a /data/blobstorage "/backups/blobstorage/$stamp"
    fi

    # Prune old blob snapshots + repozo deltas beyond the retention window.
    find /backups/blobstorage -maxdepth 1 -type d -mtime "+$KEEP_DAYS" \
        -exec rm -rf {} + 2>/dev/null || true
    "$REPOZO" --backup --gzip --repository /backups/filestorage \
        --file /data/filestorage/Data.fs --kill-old-on-full >/dev/null 2>&1 || true

    echo "[backup] $stamp done; sleeping ${INTERVAL}s"
    sleep "$INTERVAL"
done
