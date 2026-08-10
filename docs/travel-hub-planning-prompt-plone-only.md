# Travel Content Hub (Plone-only variant) — Planning Session Prompt

I'm building a self-hosted "travel content hub": an offline-first PWA to capture photos, short videos, notes, and article drafts during vacation travels, organized on a timeline with geo information. Captured content is later curated into blog articles and published on the blog. In this variant, **Plone is the backend, the archive, and the publishing target in one**: a SvelteKit PWA talks to a Plone 6 site (Classic UI) through plone.restapi, and a custom Plone add-on provides the content types, catalog indexes, and REST services for the travel stream. The public blog is the same Plone site, rendered with a Classic UI theme.

I'm an experienced Plone developer (Classic UI, Dexterity, behaviors, viewlets, plone.restapi, ZPT/Chameleon, plonecli/cookieplone conventions), so go deep on Plone specifics and don't explain basics.

Your job in this session is to **plan the implementation**: first the Plone add-on (content types, behaviors, indexes, REST services), then the PWA/offline design, then deployment, then a milestone plan. Go back and forth with me on open decisions instead of assuming.

## Decided architecture (do not re-litigate, but flag real problems)

**Overall shape**
- One Plone 6 backend (Classic UI) is the single source of truth: capture archive, curation space, and public blog live in the same site, separated by structure + workflow.
- SvelteKit PWA (adapter-static SPA + service worker) is the capture/curation client; it is served separately (nginx/Caddy), not from Plone.
- Self-hosted on a home server/VPS, docker-compose.
- Users: me + partner as Plone members; a shared Trip is a folderish object with local roles/sharing. Keep the structure such that other households/tenants could later be separate areas (or separate sites) — note the SaaS limits of this honestly.

**Plone add-on (working name: `collective.travelstream` — scaffolded with plonecli; do not use cookieplone or other generators)**
- Dexterity types:
  - `Trip` (folderish; date range, cover image, description)
  - `TravelEntry` — decide in this session: one type with an entry-kind field (photo/video/note) vs. separate types; entries hold media via plone.namedfile blobs
  - `TravelArticle` — curated blog article referencing entries/media
- Geolocation via `collective.geolocationbehavior` (or equivalent behavior) on entries + trips; latitude/longitude catalog indexes. No PostGIS: geo queries are catalog bounding-box queries; marker clustering happens client-side in MapLibre. Flag if this becomes a real limitation at expected scale (personal use).
- `captured_at` as its own DateIndex (distinct from created/effective) — the timeline is a catalog query sorted on it; expose via a custom `@travel-timeline` restapi service with batching and date/geo filters.
- Uploads: plone.restapi's built-in **TUS resumable upload** support (`@tus-upload`/`@tus-replace`) — critical for flaky travel connectivity. Videos are small ("Signal-shareable", up to ~4–5 min clips).
- Media processing on upload via event subscribers: EXIF extraction (exiftool/Pillow) writing `captured_at` + geolocation onto the entry; image scales via plone.scale as usual; video poster frame + faststart remux via ffmpeg. Decide in this session how to run ffmpeg without blocking requests: synchronous (files are small), zope clock-server/cron script, or a small external worker hitting restapi.
- Custom restapi serializers/services where the stock ones don't fit (timeline, map data as GeoJSON, publish/promote action).
- Auth: plone.restapi JWT (`@login` / token refresh) — nothing custom.

**Article format & editing**
- Editor in the PWA: TipTap. This was deliberately chosen over Plate/Slate (Plate is React-only and would require a React island inside SvelteKit; ProseMirror's enforced schema also suits JSON-as-canonical) — don't re-open this decision. Canonical ProseMirror JSON is stored on the `TravelArticle` (JSON field or annotation) so editing round-trips losslessly.
- On every save the client also writes the **HTML rendition** (generated client-side with TipTap serializers) into the standard RichText field — so Classic UI views, portlets, and search work on normal Plone richtext with zero server-side ProseMirror.
- Media references inside the HTML use `resolveuid/<uuid>` + image scale URLs, i.e. exactly Plone's native linking pattern — no placeholder rewriting layer needed in this variant.

**Publishing = workflow, not export**
- Capture area (e.g., `/trips/...`) is private; "publishing" an article is a workflow transition plus (decide: move vs. keep-in-place-and-collection) exposure in the public blog section.
- Public blog is Classic UI, themed (Bootstrap 5 based theme; my `plonetheme.clara` architecture is the likely basis).
- Versioning via CMFEditions comes free; syndication/collections for blog listing.
- Later export to other platforms (e.g., Astro) would be a separate add-on reading content over restapi — out of scope for v1, but don't design anything that blocks it (the stored Markdown-capable ProseMirror JSON is the escape hatch).

**Frontend (PWA)**
- SvelteKit adapter-static SPA + service worker (vite-plugin-pwa/Workbox)
- Offline-first via **outbox pattern** (no CRDT sync): capture into IndexedDB/OPFS (Dexie), client-side EXIF via exifr, Geolocation API fallback for notes, upload queue drains to `@tus-upload` when online (Uppy or tus-js-client)
- Map: MapLibre GL + OSM/Protomaps (PMTiles for offline map tiles of the travel region)
- Typed API client generated from plone.restapi's OpenAPI/known shapes where practical; otherwise a thin hand-written client
- Known constraint: iOS PWA storage eviction and quotas — plan around it (installed-to-homescreen; possibly "reference camera-roll video, attach when online" fallback)

**Deployment**
- docker-compose: Plone backend (+ ZEO/relstorage decision in this session), nginx/Caddy serving the PWA statics and proxying /++api++ or the restapi virtual host, backup strategy for blobstorage + Data.fs/relstorage.

## Where to start

Begin with the **add-on design**. Open questions to work through with me:
1. `TravelEntry`: one type + kind field vs. separate types (photo/video/note) — catalog, restapi serialization, and UI consequences
2. Container structure: Trip as folder containing entries vs. flat entries + Trip reference; consequences for sharing, URLs, and the public blog structure
3. Timeline + map services: what the `@travel-timeline` and GeoJSON endpoints return, batching, filters (date range, bbox, trip, kind)
4. Media pipeline: where EXIF/ffmpeg run (subscriber vs. clock-server vs. external script), and which EXIF fields become catalog metadata
5. Publish flow: workflow states/transitions for entries vs. articles; move-to-blog vs. collection-based exposure; how drafts reference not-yet-public media safely
6. Multi-user/sharing model within one site, and what "tenant-ready" means here

After the add-on design: PWA offline/outbox design in detail, then docker-compose layout, then an iteration plan (v0.1 = capture + timeline; v0.2 = curation + editor; v0.3 = public blog theming; …).
