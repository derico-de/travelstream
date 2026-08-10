#!/bin/sh
# Exercise the backup/restore mechanics (repozo + blob snapshot) against
# a scratch environment - the same commands backup.sh and README.md use,
# without docker. Run from deploy/ with the backend venv on PATH:
#
#   PATH="../backend/collective.travelstream/.venv/bin:$PATH" ./test_backup_restore.sh

set -eu

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
echo "scratch environment: $work"

mkdir -p "$work/data/filestorage" "$work/data/blobstorage" \
         "$work/backups/filestorage" "$work/backups/blobstorage"

# 1. A scratch Data.fs with real transactions + a blob file
python - "$work" <<'EOF'
import sys, transaction
from ZODB import DB
from ZODB.FileStorage import FileStorage

work = sys.argv[1]
storage = FileStorage(f"{work}/data/filestorage/Data.fs")
db = DB(storage)
conn = db.open()
conn.root()["memories"] = ["reykjavik", "vik", "hofn"]
transaction.commit()
conn.close(); db.close()
EOF
echo "travel video bytes" > "$work/data/blobstorage/clip.mp4"

# 2. Back up (same commands as backup.sh)
repozo --backup --gzip \
    --repository "$work/backups/filestorage" \
    --file "$work/data/filestorage/Data.fs"
cp -a "$work/data/blobstorage" "$work/backups/blobstorage/snapshot"

# 3. Disaster: everything under data/ is lost
rm -rf "$work/data"
mkdir -p "$work/data/filestorage" "$work/data/blobstorage"

# 4. Restore (same commands as README.md)
repozo --recover \
    --repository "$work/backups/filestorage" \
    --output "$work/data/filestorage/Data.fs"
cp -a "$work/backups/blobstorage/snapshot/." "$work/data/blobstorage/"

# 5. Verify the restored database and blobs
python - "$work" <<'EOF'
import sys
from ZODB import DB
from ZODB.FileStorage import FileStorage

work = sys.argv[1]
storage = FileStorage(f"{work}/data/filestorage/Data.fs", read_only=True)
db = DB(storage)
conn = db.open()
assert conn.root()["memories"] == ["reykjavik", "vik", "hofn"], "ZODB restore failed"
conn.close(); db.close()
print("ZODB restore verified")
EOF
grep -q "travel video bytes" "$work/data/blobstorage/clip.mp4"
echo "blobstorage restore verified"
echo "backup/restore exercise PASSED"
