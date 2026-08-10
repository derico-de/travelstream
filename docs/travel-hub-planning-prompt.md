# Travel Content Hub — Planning Session Prompt

I'm building a self-hosted "travel content hub": an offline-first PWA to capture photos, short videos, notes, and article drafts during vacation travels, organized on a timeline with geo information. In a second step, captured content is curated into blog articles and published to external platforms via a pluggable adapter layer — first target is Plone (Classic UI), later other CMSs and static-site generators like Astro.

The architecture is already decided (see below). Your job in this session is to **plan the implementation**, starting with the **data model**, then the **PWA/offline design**, then **deployment layout**, then a **milestone/iteration plan**. Go back and forth with me on open decisions instead of assuming.

## Decided architecture (do not re-litigate, but flag real problems)

**Overall shape**
- Neutral content hub (the archive) is separate from publishing targets. Plone is a *publish target*, not the backend.
- Self-hosted on a home server/VPS, deployed via docker-compose.
- Users: initially me + partner (one shared household workspace). Design for multi-tenancy from day one (every content table carries `workspace_id`) because a paid SaaS is a possible future.

**Backend (Python)**
- FastAPI + SQLAlchemy + GeoAlchemy2
- Postgres + PostGIS (timeline = indexed `captured_at` queries; geo = PostGIS)
- Resumable uploads via tus (tusd or equivalent), because of flaky travel connectivity
- Background worker: dramatiq or arq + Redis. Jobs: server-side EXIF extraction (exiftool as source of truth), image derivatives (pyvips), video poster frame + faststart remux (ffmpeg; full transcode only as fallback — videos are small, "Signal-shareable" size, up to ~4–5 min drone clips)
- Media storage: plain filesystem volumes (not MinIO) for now; backup-friendly (restic/borg)
- Auth: fastapi-users + hand-rolled `workspace` / `workspace_member` tables
- API is OpenAPI-first; the PWA consumes a generated typed TS client (openapi-typescript / hey-api)

**Publishing adapters**
- Python packages registered via setuptools entry points (Plone/plonecli-style plugin pattern)
- Interface roughly: `publish(article, media_resolver, target_config) -> remote_ref`, plus `update()` / `unpublish()`
- First adapter: Plone via plone.restapi (uploads referenced media as Image content, maps article → Document/News Item, uses resolveuid/scale URLs)
- Later: Astro adapter (render markdown + frontmatter + assets, commit/push to a git repo, CI builds the site)
- A publish-job/mapping table must remember where each article went (target, remote id/path, state) so update and unpublish work

**Article format**
- Canonical: ProseMirror JSON (TipTap editor in the PWA)
- The Python backend never parses ProseMirror. On every save, the client also stores pre-rendered **HTML and Markdown renditions**, generated client-side with shared TipTap serializers. Media inside renditions are placeholders (`<img data-media-id="uuid">` / `![](media:uuid)`); adapters upload media to the target and rewrite placeholders to target URLs.
- Optional later: a small Node CLI in the worker importing the same editor package for server-initiated re-rendering. Not part of v1.

**Frontend (PWA)**
- SvelteKit with adapter-static (SPA app shell) + service worker (vite-plugin-pwa/Workbox)
- Offline-first via **outbox pattern** (not full CRDT sync): capture into IndexedDB/OPFS (Dexie), client-side EXIF via exifr, Geolocation API fallback for notes, upload queue drains when online (tus client / Uppy)
- Map: MapLibre GL + OSM/Protomaps (PMTiles could give offline map tiles for the travel region)
- Editor: TipTap (deliberately chosen over Plate/Slate — Plate is React-only and would require a React island in SvelteKit; ProseMirror's enforced schema suits ProseMirror-JSON-as-canonical; don't re-open)
- Known constraint: iOS PWA storage eviction and quotas — plan around it (installed-to-homescreen requirement; possibly "reference camera-roll video, attach when online" as fallback)

**Monorepo layout (pnpm workspace for the TS parts is fine; backend is Python)**
```
apps/pwa            SvelteKit PWA
apps/api            FastAPI
apps/worker         dramatiq/arq jobs
packages/editor     TipTap extensions + ProseMirror schema + HTML/MD serializers (client-side only)
adapters/plone      Python package
adapters/astro      Python package (later)
```

## Where to start

Begin with the **data model**. Open questions to work through with me:
1. Trip → Entry (photo/video/note) structure; is an Article a separate curated object referencing entries/media, or a special entry type?
2. Geo: per-entry points only, or also recorded tracklines per trip? How are clusters/timeline+map views queried?
3. Media model: original + derivatives, EXIF fields worth first-class columns vs. JSONB
4. Publish mapping tables: article ↔ target ↔ remote ref, versioning/state machine for publish jobs
5. Workspace/member/auth tables and how workspace scoping is enforced (query-level vs. Postgres RLS)

After the data model: PWA offline/outbox design in detail, then docker-compose deployment layout, then an iteration plan (v0.1 = capture + timeline; v0.2 = curation + editor; v0.3 = Plone publishing; …).
