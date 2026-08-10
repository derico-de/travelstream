# Travelstream deployment

One `docker compose` file runs the whole stack on a home server or VPS:
Plone backend (single instance, filestorage + blobstorage — no ZEO, no
relstorage), nginx (PWA statics + same-origin REST proxy), the ffmpeg
media worker, and a scheduled backup job.

## First run

```sh
cd deploy
cp .env.example .env        # set real passwords
# Build the PWA statics once (nginx mounts frontend/build):
(cd ../frontend && pnpm install && pnpm build)
docker compose up -d
```

Then, once:

1. Open `http://<host>:8080` (or `docker compose exec backend ...`) and
   create a Plone site with id **Plone** (Classic UI distribution). The
   `PROFILES` env installs `collective.travelstream:default` automatically
   when the image creates the site; if you created the site manually,
   install the **Travelstream** add-on in Site Setup → Add-ons.
2. Create a `trips` Folder, your first Trip, and a dedicated worker user
   (Editor role on the trips area) matching `WORKER_USER`/`WORKER_PASSWORD`.

URLs (same origin — no CORS setup anywhere):

- `/` — the PWA
- `/++api++/...` — plone.restapi, proxied to the backend
- `/cms/...` — Plone Classic UI (curation fallback + public blog theme)

## Backups

The `backup` service loops forever: every `BACKUP_INTERVAL_SECONDS`
(default: daily) it writes

- `backups/filestorage/` — **repozo** incrementals (gzip) against the last
  full backup of `Data.fs`
- `backups/blobstorage/<timestamp>/` — hardlinked blobstorage snapshots
  (unchanged blobs cost no space); `backups/blobstorage/latest` points at
  the newest one

Snapshots older than `BACKUP_KEEP_DAYS` (default 30) are pruned. Point
`BACKUP_DIR` at a disk that is **not** the one holding `/data`.

## Restore procedure

Tested against a scratch environment (see `test_backup_restore.sh`, which
exercises the same repozo + snapshot mechanics without docker).

```sh
docker compose stop backend worker

# 1. Data.fs from the repozo repository (latest state):
docker compose run --rm --no-deps \
  -v ./backups:/backups backend \
  /app/bin/repozo --recover --repository /backups/filestorage \
                  --output /data/filestorage/Data.fs
# (add --date YYYY-MM-DD-HH-MM-SS to restore a point in time)

# 2. Blobstorage from the matching snapshot:
docker compose run --rm --no-deps --entrypoint /bin/sh \
  -v ./backups:/backups backend -c \
  'rm -rf /data/blobstorage/* && cp -a /backups/blobstorage/latest/. /data/blobstorage/'

# 3. Remove a stale Data.fs.index (it is rebuilt on start) and restart:
docker compose run --rm --no-deps --entrypoint /bin/sh backend -c \
  'rm -f /data/filestorage/Data.fs.index'
docker compose up -d
```

After a point-in-time restore, pick the blob snapshot whose timestamp
matches the repozo `--date` — blobs written after that moment would
otherwise be orphaned (harmless) or missing for newer objects.

## Notes

- The worker needs no ZODB access; it authenticates over restapi with
  `WORKER_USER`. Keep that a dedicated user so its edits are attributable.
- TLS: put Caddy/Traefik/certbot in front, or extend the nginx config —
  the stack only assumes "same origin", not a specific scheme.
- Scaling day: this deliberately stays a single Zope process. Revisit
  ZEO/relstorage only if a second process ever needs the database.
