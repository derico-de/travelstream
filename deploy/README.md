# Travelstream deployment

Four moving parts, however you choose to run them:

| Part | What it is |
| --- | --- |
| **backend** | a single Plone instance (filestorage + blobstorage — no ZEO, no relstorage) |
| **web** | TLS edge: PWA statics + the REST proxy |
| **worker** | ffmpeg media worker (poster frame + faststart remux), restapi only |
| **backup** | repozo incrementals + blobstorage snapshots |

Two supported layouts:

- **[Native](#native-install-systemd)** — Plone under systemd, Caddy
  installed on the host (typically already serving other sites). Nothing
  is containerised. This is the production setup.
- **[Docker compose](#docker-compose)** — `docker-compose.yml` runs all
  four in containers. Good for a fresh box or for trying the stack out.

They are not exclusive per-part: the Caddy config does not care whether
Plone is a container or a systemd unit, only what address it listens on.

TLS and hostnames are in **[CADDY.md](./CADDY.md)** for both layouts.

## Native install (systemd)

Assumed layout — adjust the paths to your machine:

| | Path |
| --- | --- |
| Plone venv | `/opt/plone/venv` |
| Zope instance (holds `var/`) | `/var/lib/plone/instance` |
| This checkout | `/srv/travelstream` |
| Plone listens on | `127.0.0.1:8080` |
| Plone site id | `Plone` |
| Backups | `/srv/backups/travelstream` |

Bind Zope to `127.0.0.1`, not `0.0.0.0`: Caddy is the only thing that
should reach it, and a directly reachable Zope port bypasses the
virtual-host rewrites (see CADDY.md).

### 1. The add-on

```sh
/opt/plone/venv/bin/pip install -e /srv/travelstream/backend/collective.travelstream
systemctl restart plone
```

No ZCML wiring needed: the package declares a
`z3c.autoinclude.plugin` entry point targeting `plone`, so Plone loads it
on start. Then, once, in the running site:

1. Create a Plone site with id `Plone` (**Classic UI** distribution — not
   Volto, whose profile drops `Folder` from the addable types and so
   breaks the add-on's `/Plone/trips` container).
2. Site Setup → Add-ons → install **Travelstream**.
3. Create a `trips` Folder, your first Trip, and a dedicated worker user
   with the Editor role on the trips area.

### 2. The PWA

```sh
cd /srv/travelstream/frontend
pnpm install --frozen-lockfile
pnpm build          # writes frontend/build/
```

Caddy serves `frontend/build` straight off disk — no service to restart
after a rebuild. Every directory on the path must be traversable by the
`caddy` user (`chmod o+x`), or you get 403s on the statics.

### 3. Caddy

See [CADDY.md](./CADDY.md). On a host that already serves other sites, it
comes down to one line in `/etc/caddy/Caddyfile`:

```caddyfile
import /srv/travelstream/deploy/Caddyfile
```

Both shipped Caddyfiles are site blocks only — no global options block, and
their snippets are prefixed `travelstream_` — specifically so they can be
imported next to your existing sites without colliding.

That serves the PWA on `app.travel.planetcrazy.de` with `/++api++` proxied
into Plone on the same origin, and the Classic UI on
`travel.planetcrazy.de`. To run the two fully apart instead — the app
pointed at the backend's own origin, so one Plone can sit behind several
frontends — build with `VITE_API_BASE` and import
[`Caddyfile.split`](./Caddyfile.split); that one needs CORS, and CADDY.md
lists exactly which headers.

### 4. The media worker

Needs `python3`, `requests` and `ffmpeg` on the box. It talks restapi only
and never touches the ZODB, so it can run as its own unprivileged user.

`/etc/systemd/system/travelstream-worker.service`:

```ini
[Unit]
Description=Travelstream media worker
After=network.target plone.service
Wants=plone.service

[Service]
Type=simple
User=travelstream
WorkingDirectory=/srv/travelstream/worker
Environment=PLONE_URL=http://127.0.0.1:8080/Plone
Environment=POLL_SECONDS=15
# Keep the password out of the unit file: 0600, owned by root.
EnvironmentFile=/etc/travelstream/worker.env
ExecStart=/usr/bin/python3 worker.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

`/etc/travelstream/worker.env`:

```sh
PLONE_USER=mediaworker
PLONE_PASSWORD=...
```

```sh
systemctl enable --now travelstream-worker
journalctl -u travelstream-worker -f
```

Note `PLONE_URL` goes straight to Zope's physical path
(`http://127.0.0.1:8080/Plone`), bypassing Caddy — the worker wants no
virtual-host rewriting.

### 5. Backups

`backup.sh` takes its paths from the environment, so the same script works
natively. `ONESHOT=1` makes it run once and exit, leaving the schedule to a
systemd timer instead of its internal sleep loop.

`/etc/systemd/system/travelstream-backup.service`:

```ini
[Unit]
Description=Travelstream backup (repozo + blobstorage snapshot)

[Service]
Type=oneshot
Environment=ONESHOT=1
Environment=FILESTORAGE=/var/lib/plone/instance/var/filestorage
Environment=BLOBSTORAGE=/var/lib/plone/instance/var/blobstorage
Environment=BACKUPS=/srv/backups/travelstream
Environment=KEEP_DAYS=30
Environment=PATH=/opt/plone/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/bin/sh /srv/travelstream/deploy/backup.sh
```

`repozo` comes from the Plone venv, which is why it is on `PATH` above.

`/etc/systemd/system/travelstream-backup.timer`:

```ini
[Unit]
Description=Daily Travelstream backup

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl enable --now travelstream-backup.timer
systemctl start travelstream-backup.service   # run one now to check it
systemctl list-timers travelstream-backup.timer
```

repozo reads a live `Data.fs` safely, so Plone keeps running. Point
`BACKUPS` at a disk that is **not** the one holding the instance.

## Docker compose

```sh
cd deploy
cp .env.example .env        # set real passwords
(cd ../frontend && pnpm install && pnpm build)
docker compose up -d
```

The image auto-creates the `Plone` site (`TYPE=classic`) and installs the
add-on via `PROFILES`; if you created the site by hand, install
**Travelstream** in Site Setup → Add-ons. Then create the `trips` Folder,
your first Trip, and the worker user matching
`WORKER_USER`/`WORKER_PASSWORD`.

Out of the box this is plain HTTP on one hostname via nginx:

- `/` — the PWA
- `/++api++/...` — plone.restapi, proxied to the backend
- `/cms/...` — Plone Classic UI

[CADDY.md](./CADDY.md) covers replacing that with Caddy and real
hostnames.

## Backups

Whichever layout, the backup step writes:

- `filestorage/` — **repozo** incrementals (gzip) against the last full
  backup of `Data.fs`
- `blobstorage/<timestamp>/` — hardlinked blobstorage snapshots (unchanged
  blobs cost no space); `blobstorage/latest` points at the newest

Snapshots older than `KEEP_DAYS` (default 30) are pruned.

| Variable | Container default | Native |
| --- | --- | --- |
| `FILESTORAGE` | `/data/filestorage` | `<instance>/var/filestorage` |
| `BLOBSTORAGE` | `/data/blobstorage` | `<instance>/var/blobstorage` |
| `BACKUPS` | `/backups` | wherever the timer points it |
| `ONESHOT` | `0` (sleep loop) | `1` (systemd timer schedules it) |

## Restore procedure

The repozo + snapshot mechanics are exercised by `test_backup_restore.sh`
without docker.

Native:

```sh
systemctl stop plone travelstream-worker

INSTANCE=/var/lib/plone/instance
BACKUPS=/srv/backups/travelstream

# 1. Data.fs from the repozo repository (latest state).
#    Add --date YYYY-MM-DD-HH-MM-SS for a point in time.
/opt/plone/venv/bin/repozo --recover \
    --repository "$BACKUPS/filestorage" \
    --output "$INSTANCE/var/filestorage/Data.fs"

# 2. Blobstorage from the matching snapshot:
rm -rf "$INSTANCE/var/blobstorage"/*
cp -a "$BACKUPS/blobstorage/latest/." "$INSTANCE/var/blobstorage/"

# 3. Drop the stale index (rebuilt on start) and come back up:
rm -f "$INSTANCE/var/filestorage/Data.fs.index"
chown -R plone:plone "$INSTANCE/var"
systemctl start plone travelstream-worker
```

Docker compose:

```sh
docker compose stop backend worker

docker compose run --rm --no-deps \
  -v ./backups:/backups backend \
  /app/bin/repozo --recover --repository /backups/filestorage \
                  --output /data/filestorage/Data.fs

docker compose run --rm --no-deps --entrypoint /bin/sh \
  -v ./backups:/backups backend -c \
  'rm -rf /data/blobstorage/* && cp -a /backups/blobstorage/latest/. /data/blobstorage/'

docker compose run --rm --no-deps --entrypoint /bin/sh backend -c \
  'rm -f /data/filestorage/Data.fs.index'
docker compose up -d
```

After a point-in-time restore, pick the blob snapshot whose timestamp
matches the repozo `--date` — blobs written after that moment would
otherwise be orphaned (harmless) or missing for newer objects.

## Notes

- The worker needs no ZODB access; it authenticates over restapi with its
  own user. Keep that a dedicated account so its edits are attributable.
- Scaling day: this deliberately stays a single Zope process. Revisit
  ZEO/relstorage only if a second process ever needs the database.
