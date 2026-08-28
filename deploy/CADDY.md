# Deploying with Caddy: PWA and Plone on one server

**Caddy** as the TLS edge, serving the PWA and Plone from one machine
under two names. This works the same whether Plone runs natively under
systemd or in the compose stack, and whether Caddy is dedicated to
Travelstream or already serving other sites — see
[Option A](#option-a--caddy-already-on-the-host) and
[Option B](#option-b--caddy-inside-the-compose-stack). It replaces the
plain-HTTP, single-hostname nginx service in `docker-compose.yml`.

There are two topologies, and the choice only affects where the API is
served from:

| | [Proxied](#the-one-rule-the-api-stays-on-the-apps-origin) (default) | [Separated](#separated-app-and-backend) |
| --- | --- | --- |
| Config | [`Caddyfile`](./Caddyfile) | [`Caddyfile.split`](./Caddyfile.split) |
| PWA build | `pnpm build` | `VITE_API_BASE=… pnpm build` |
| API origin | the app's own | the backend's own |
| CORS | none anywhere | preflight on every authenticated request |
| Backend reusable by other frontends | no | yes |

Start with the proxied layout. Take the separated one only when you
actually need the backend to stand on its own — different machines, or one
Plone serving more than this app.

| Hostname                    | Serves (proxied layout)                                     |
| --------------------------- | ---------------------------------------------------------- |
| `app.travel.planetcrazy.de` | the PWA, **and** `/++api++` proxied into Plone              |
| `travel.planetcrazy.de`     | Plone Classic UI at the root — public site, curation fallback |

## The one rule: the API stays on the app's origin

`app.travel.planetcrazy.de` proxies `/++api++` itself. Do **not** point the
PWA at `https://travel.planetcrazy.de/++api++`.

The PWA is built for a same-origin API and nothing in it is configurable
per environment:

- `ApiClient` defaults its base URL to the relative path `/++api++`
  (`frontend/src/lib/api/client.ts`), and `resolve()` throws away the host
  of any absolute URL Plone returns, keeping only path and query.
- Image scales are rendered straight into `<img src>` as
  `/++api++/<path>/@@images/...` (`frontend/src/lib/format.ts`).
- TUS uploads route every PATCH/HEAD/DELETE through `resolve()` on purpose
  (`ProxyHttpStack` in `frontend/src/lib/outbox/tus-transport.ts`), because
  the backend answers upload creation with an absolute `Location` built
  from its own virtual-host view.
- The service worker's `navigateFallbackDenylist` excludes `/++api++` from
  the SPA fallback (`frontend/vite.config.ts`).

All of that is now driven by one setting (`frontend/src/lib/api/base.ts`),
so pointing the app elsewhere is supported — see
[Separated app and backend](#separated-app-and-backend). It is not the
default because the same-origin layout means there is no CORS
configuration anywhere in this deployment, and no preflight on any of the
5 MB TUS chunks. Same property the single-host nginx setup has.

Both hostnames reach the same Plone site; each just sees its own canonical
URL, because the `VirtualHostBase` segment names the host per site block.

## Prerequisites

1. **DNS** — two A/AAAA records pointing at the server:

   ```
   travel.planetcrazy.de.      A   <server ip>
   app.travel.planetcrazy.de.  A   <server ip>
   ```

   Create both *before* starting Caddy; it requests certificates on the
   first start and a `NXDOMAIN` counts against Let's Encrypt failure
   limits.

2. **Firewall** — inbound 80 and 443 (TCP; also UDP 443 if you want
   HTTP/3). Port 80 must stay open permanently: Caddy uses it for the
   HTTP-01 challenge on every renewal, and to redirect to HTTPS.

3. **The PWA build** — `frontend/build/`, produced on the server (or
   shipped there):

   ```sh
   cd frontend && pnpm install --frozen-lockfile && pnpm build
   ```

Pick the option matching where Caddy runs. The Caddyfile is the same
either way — only the upstream address and the statics root differ, and
both are environment variables.

## Option A — Caddy already on the host

The production setup: Caddy is installed on the machine and already serves
other sites, and Plone runs natively under systemd (see
[README.md](./README.md#native-install-systemd)). Nothing here is
containerised.

1. **Bind Zope to loopback.** Caddy must be the only thing that can reach
   it — a directly reachable Zope port bypasses the virtual-host rewrites
   and hands out `:8080` URLs. In the instance's `zope.conf` / `wsgi.ini`,
   listen on `127.0.0.1:8080`, not `0.0.0.0:8080`. (Running Plone in
   compose instead? Publish it as `"127.0.0.1:8080:8080"` and drop the
   `web` service.)

2. **Put the checkout where Caddy can read it** — `/srv/travelstream` in
   these docs. Every directory on the path to `frontend/build` must be
   traversable by the `caddy` user (`chmod o+x`), or the statics 403.

3. **Import the site blocks** into `/etc/caddy/Caddyfile`:

   ```caddyfile
   import /srv/travelstream/deploy/Caddyfile
   ```

   This is safe next to your other sites. Both shipped Caddyfiles contain
   *site blocks only* — no global options block, which Caddy allows in the
   main file only and only once — and their snippets are named
   `travelstream_plone` / `travelstream_cors` so they cannot collide with
   snippets you already define. The ACME contact address is set per site
   with `tls` rather than globally; if your own global block already sets
   `email`, delete those two `tls` lines.

4. **Check the defaults, or override them.** The file defaults to
   `PLONE_UPSTREAM=127.0.0.1:8080` and
   `PWA_ROOT=/srv/travelstream/frontend/build`, which match the layout
   above. For different paths, set them in Caddy's unit
   (`systemctl edit caddy`) — placeholders are resolved from Caddy's own
   environment at parse time:

   ```ini
   [Service]
   Environment=PWA_ROOT=/opt/travelstream/frontend/build
   Environment=PLONE_UPSTREAM=127.0.0.1:8080
   ```

5. **Reload:**

   ```sh
   caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

   Reloads are zero-downtime and will not disturb the other sites. If
   `validate` fails, nothing is applied — fix it before reloading.

Your existing certificates and ACME account are untouched; Caddy just adds
two more names to the ones it already manages.

### Variant — a standalone file in `conf.d`

`systemctl edit caddy` sets the environment of the whole daemon: there is
no per-site scoping for `{$VAR}` placeholders, so a second site of yours
reading `{$PWA_ROOT}` would silently pick up Travelstream's value. Two ways
around it, depending on which you find cheaper.

**Keep the import, make the defaults true.** Symlink the checkout to the
path the shipped file already defaults to, and set nothing:

```sh
sudo ln -s /home/plone/travel.planetcrazy.de/travelstream /srv/travelstream
```

**Or wire the values in literally**, in your own
`/etc/caddy/conf.d/app.travel.planetcrazy.de.conf`, and do not import
[`Caddyfile`](./Caddyfile) at all. Useful when Plone Classic already has
its own conf on the host and only the app host is new:

```caddyfile
app.travel.planetcrazy.de {
	encode gzip zstd

	log {
		output file /var/log/caddy/app.travel.planetcrazy.de.access.log
		format console
	}

	handle /health {
		respond 200
	}

	handle_path /++api++/* {
		rewrite * /VirtualHostBase/https/{host}:443/Plone/++api++/VirtualHostRoot{uri}
		reverse_proxy 127.0.0.1:8080 {
			transport http {
				dial_timeout 10s
				response_header_timeout 600s
			}
		}
	}

	handle {
		root * /srv/app.travel.planetcrazy.de/build

		@immutable path /_app/immutable/*
		header @immutable Cache-Control "public, max-age=31536000, immutable"

		@mutable not path /_app/immutable/*
		header @mutable Cache-Control "no-cache"

		try_files {path} /index.html
		file_server
	}
}
```

with `/srv/app.travel.planetcrazy.de` a symlink to the checkout's
`frontend/` (root is `<link>/build`, for the same reason the compose mount
is one level up — the adapter recreates `build/` on every rebuild).

Three things this variant gets wrong easily:

- **`handle` blocks, not bare directives.** Caddy orders directives by its
  own table rather than by line order, and `try_files` runs before
  `respond` — so a `/health` written as a top-level `respond` is rewritten
  to `/index.html` before its matcher is ever evaluated, and answers with
  the SPA shell. Wrapping each branch in `handle` makes the order explicit.
- **`/++api++` still belongs here**, even when Plone Classic is configured
  elsewhere. It is not the Plone site; it is the API on the *app's* origin,
  which is [the one rule](#the-one-rule-the-api-stays-on-the-apps-origin).
  Both blocks proxy the same Zope, each with its own `VirtualHostBase`.
- **`Cache-Control` is not optional.** `file_server` sends `Etag` and
  `Last-Modified` but no `Cache-Control`, which leaves `index.html`,
  `sw.js` and `_app/version.json` to browser heuristic caching — the exact
  way clients get stranded on an old build.

The cost of this variant is drift: it is a copy, so changes to
[`Caddyfile`](./Caddyfile) do not reach it. Diff the two when you update.

## Option B — Caddy inside the compose stack

For a box that only serves Travelstream: everything stays in one file and
Caddy reaches Plone over the compose network.

Replace the `web` (nginx) service in `docker-compose.yml` with:

```yaml
  web:
    image: docker.io/library/caddy:2-alpine
    restart: unless-stopped
    environment:
      APP_HOST: ${APP_HOST:-app.travel.planetcrazy.de}
      PUBLIC_HOST: ${PUBLIC_HOST:-travel.planetcrazy.de}
      ACME_EMAIL: ${ACME_EMAIL:-webmaster@planetcrazy.de}
      # Compose-internal upstream; Caddy re-resolves the name on every
      # dial, so recreating the backend container needs no resolver hack
      # (this is the bug the nginx config worked around with its runtime
      # resolver + `set $plone`).
      PLONE_UPSTREAM: backend:8080
      PWA_ROOT: /usr/share/caddy/build
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      # Mount the parent dir, not build/ itself: the SvelteKit adapter
      # deletes and recreates build/ on every rebuild, which would leave a
      # bind mount pointing at a deleted directory. Root is <mount>/build.
      - ../frontend:/usr/share/caddy:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
```

and add the two named volumes at the bottom of the file:

```yaml
volumes:
  filestorage:
  blobstorage:
  caddy_data:
  caddy_config:
```

`caddy_data` holds the issued certificates and the ACME account key. Losing
it forces a full re-issue on the next start — keep it, and include it in
whatever you back up outside of `backup.sh` (the backup service only covers
the ZODB).

Stop publishing the backend on the host while you are in there — with Caddy
in the same compose network, nothing outside needs port 8080, and an
unproxied Zope port bypasses the virtual-host rewrites:

```yaml
  backend:
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8080}:8080"   # was "${BACKEND_PORT:-8080}:8080"
```

Then:

```sh
cd deploy
docker compose up -d
docker compose logs -f web        # watch the certificates being issued
```

## What the Caddyfile does, and why

**`VirtualHostBase` rewrites.** Plone generates absolute URLs from the
virtual-host path segments, not from `Host` or `X-Forwarded-*`. Each site
block therefore rewrites the request path before proxying:

| Request                                        | Rewritten to                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `app…/++api++/trips/alps/@travel-timeline`      | `/VirtualHostBase/https/app…:443/Plone/++api++/VirtualHostRoot/trips/alps/@travel-timeline` |
| `travel…/trips/alps`                            | `/VirtualHostBase/https/travel…:443/Plone/VirtualHostRoot/trips/alps`              |

Note `https` and `:443` — the nginx config it replaces used `http` and
`$http_host` because it terminated nothing. Getting this wrong is the
single most common failure here: Plone starts emitting `http://` `@id`
values and the browser blocks them as mixed content.

`{host}` is safe to interpolate: a site block only runs for requests whose
`Host` already matched its address.

**`handle_path /++api++/*`** strips the prefix before the rewrite, so
`{uri}` is the in-site path; the prefix is re-added on the Plone side of
`VirtualHostBase`, which is where `plone.rest` expects to traverse it.

**Caching.** `_app/immutable/*` is content-hashed and gets a one-year
`immutable`; everything else — `index.html`, `sw.js`, `registerSW.js`,
`manifest.webmanifest`, `_app/version.json` — gets `no-cache`, because
those files are what tell a running client that a new build exists.

**No body-size or buffering settings.** Caddy has no equivalent of nginx's
`client_max_body_size` (unlimited by default) and does not buffer proxied
request bodies, so TUS chunks stream through as they arrive. The `2G`
limit and `proxy_request_buffering off` from `nginx.conf` have no
counterpart to port.

## Verify the cutover

```sh
# Certificates and the SPA shell
curl -sI https://app.travel.planetcrazy.de/ | head -n 3

# The API answers on the app origin, and says so in @id
curl -s -H 'Accept: application/json' https://app.travel.planetcrazy.de/++api++/ \
  | head -c 200
# -> {"@id": "https://app.travel.planetcrazy.de/++api++", ...}

# A deep link falls back to the SPA instead of 404ing
curl -s -o /dev/null -w '%{http_code}\n' https://app.travel.planetcrazy.de/trips/anything

# Public site
curl -s https://travel.planetcrazy.de/ | grep -o '<title>[^<]*'
```

If `@id` comes back as `http://…`, `…:8080`, or `backend:8080`, the
`VirtualHostBase` segment is wrong — nothing downstream will work, so fix
that before looking anywhere else.

Then, in a browser: install the PWA from `app.travel.planetcrazy.de`, log
in, capture a photo offline, and let the outbox flush. That exercises TLS,
the JWT round-trip, TUS resume and the worker in one go.

## Updating the PWA

```sh
cd frontend && pnpm install --frozen-lockfile && pnpm build
```

On a separated deployment, pass `VITE_API_BASE` on every rebuild — it is
baked into the bundle, and a plain `pnpm build` silently reverts the app to
expecting a same-origin proxy that is not there.

Nothing to reload: Caddy serves the files from disk, and both options mount
or read `frontend/build` live. Clients pick the new build up because the
shell files are `no-cache` and the service worker is registered with
`registerType: 'autoUpdate'`.

Reload Caddy only when the Caddyfile itself changed — `sudo systemctl
reload caddy` (Option A) or `docker compose exec web caddy reload --config
/etc/caddy/Caddyfile` (Option B). Reloads are zero-downtime and leave the
host's other sites alone; a restart is not needed and would re-check
certificates.

## Separated app and backend

Use [`Caddyfile.split`](./Caddyfile.split) when the app must not proxy the
backend: the two live on different machines, the Plone site is shared with
other frontends, or you want one hosted build that can be aimed at a
chosen backend.

```
app.travel.planetcrazy.de   the PWA statics only — no proxy at all
travel.planetcrazy.de       Plone Classic UI at /, REST API at /++api++
                            with CORS for the app origin
```

The two site blocks are independent. If the hosts are on different
servers, put each block in that server's Caddyfile and delete the other.

### 1. Build the PWA against the backend

```sh
cd frontend
VITE_API_BASE=https://travel.planetcrazy.de/++api++ pnpm build
```

Everything that constructs a backend URL reads that one value
(`src/lib/api/base.ts`): the `ApiClient` base, `browseUrl()` for image
scales and media, the TUS `Location` rebasing, and the service worker's
image-cache route. Unset, it stays `/++api++` and you get the proxied
layout — the default build is unchanged.

You can also override it at runtime, without rebuilding:

```js
localStorage.setItem('travelstream.apiBase', 'https://other.example/++api++');
// then reload
```

That is the seam for the "point it at any Plone" idea; see
[One frontend, many backends](#one-frontend-many-backends) for what is
still missing before that is a real feature.

### 2. Serve it

Same two options as above (host Caddy or compose service), only with
`Caddyfile.split` in place of `Caddyfile` — so on a host Caddy that is
`import /srv/travelstream/deploy/Caddyfile.split` — and `APP_ORIGIN` set
to the exact origin the PWA is served from:

```sh
APP_ORIGIN=https://app.travel.planetcrazy.de
```

The app host in this layout answers `404` for `/++api++` instead of
falling through to the SPA shell — otherwise a build that forgot
`VITE_API_BASE` would answer every API call with HTML and a `200`, which
shows up as unexplained JSON parse errors.

### What CORS has to allow, and why it is easy to get wrong

The Caddyfile handles this, but if you terminate somewhere else, these are
the parts that actually bite:

- **`Access-Control-Expose-Headers` must include `Location` and
  `Upload-Offset`.** Cross-origin, a browser hides every response header
  not on that list. tus-js-client reads the upload URL out of `Location`
  and the resume point out of `Upload-Offset`; without them uploads appear
  to work and then restart from zero on every retry.
- **The allowed methods must include `PATCH`, `HEAD` and `DELETE`**, not
  just `GET`/`POST` — that is the TUS verb set.
- **The allowed request headers must include `Tus-Resumable`,
  `Upload-Length`, `Upload-Metadata` and `Upload-Offset`** alongside
  `Authorization`.
- **CORS must cover image responses too, not just JSON.** Backend `<img>`
  tags are emitted with `crossorigin="anonymous"` in a cross-origin build,
  because an opaque response cannot enter the service worker's image cache
  — offline photos would silently stop working. The flip side: if the
  backend does not send `Access-Control-Allow-Origin` on `/++api++`,
  images fail to render at all rather than just failing to cache. Putting
  the header on the whole `/++api++` path, as the Caddyfile does, covers
  both.
- **No `Access-Control-Allow-Credentials`.** Auth is a JWT in the
  `Authorization` header, so nothing needs cookies across origins — which
  is what keeps the origin allowlist meaningful.

An alternative to doing this at the edge is `plone.rest`'s
`<plone:CORSPolicy>` ZCML directive in the add-on. The edge is the better
place here: the allowlist is deployment configuration, and it keeps
`collective.travelstream` free of hostnames.

### Verify

```sh
APP=https://app.travel.planetcrazy.de

# Preflight is answered, and exposes the TUS headers
curl -si -X OPTIONS -H "Origin: $APP" \
     -H 'Access-Control-Request-Method: PATCH' \
     https://travel.planetcrazy.de/++api++/trips \
  | grep -i 'access-control'

# An unknown origin gets no CORS headers at all
curl -si -X OPTIONS -H 'Origin: https://evil.example' \
     https://travel.planetcrazy.de/++api++/trips | grep -ci 'access-control'
# -> 0

# Images carry the header too (crossorigin="anonymous" depends on it)
curl -si -H "Origin: $APP" \
     'https://travel.planetcrazy.de/++api++/trips/<trip>/<item>/@@images/image' \
  | grep -i 'access-control-allow-origin'
```

Then upload a photo from the installed PWA and kill the network
mid-upload: it must resume from the offset, not restart. That is the check
that a wrong `Expose-Headers` fails.

## One frontend, many backends

Pointing one hosted build at an arbitrary Plone mostly works today — the
API base is a single setting, and the backend contract is plain
plone.restapi plus this add-on's endpoints. What is *not* done, if you
want to take the idea further:

- **Per-backend local state.** The JWT (`travelstream.token`), the outbox
  Dexie database (`travelstream-outbox`), the media URL cache
  (`travelstream.media.v1`), the remembered trip (`travelstream.lastTrip`)
  and the cached settings are all stored under fixed keys. Switching
  backends in one browser profile would have them collide — a queued
  upload could flush to the wrong site. These keys need the backend origin
  folded in before switching is safe.
- **A way to choose.** Today the override is a `localStorage` key. A real
  feature needs a server field on the login screen and somewhere to show
  which backend you are on.
- **The add-on has to be installed.** The PWA calls
  `@travel-timeline`, `@travel-geojson` and the Travelstream settings
  endpoint; a stock Plone answers 404. Version negotiation would need to
  be worked out.
- **Every backend needs its own CORS entry** for the frontend's origin, so
  "any Plone" really means "any Plone whose operator opted in".

None of that is required for the separated deployment above, which targets
exactly one backend.

## Optional hardening

Keep the app shell out of search results (the content is public via
`travel.planetcrazy.de`; the app shell is not useful to index). Add inside
the app host's site block, before the `handle` block:

```caddyfile
handle /robots.txt {
	respond "User-agent: *
Disallow: /
" 200
}
```

If you want `Strict-Transport-Security` to cover future subdomains, add
`includeSubDomains` — but only once you are sure every name under
`travel.planetcrazy.de` can do HTTPS, since it is not revocable in the
browser for the header's lifetime.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Images and links use `http://`, browser blocks mixed content | `VirtualHostBase` still says `http`; must be `https` with `:443` |
| `@id` values contain `backend:8080` or `127.0.0.1` | request reached Zope without the `VirtualHostBase` rewrite — check the site block matched, and that the backend port is not exposed publicly |
| 404 on reload of `/trips/...` | `try_files {path} /index.html` missing from the PWA `handle` block |
| 403 on all statics (host Caddy) | a directory on the path to `frontend/build` is not traversable by the `caddy` user |
| Uploads restart from zero on every retry | the TUS `Location` is not being resolved back onto the app origin — verify the API is served from the app hostname, not the public one |
| Certificate issuance fails | port 80 blocked, or the DNS record does not resolve to this server yet; `docker compose logs web` / `journalctl -u caddy` names the challenge that failed |
| Users stuck on an old build | `index.html` / `sw.js` served with a cache header — check `curl -sI https://app…/sw.js` |
| API 502s right after `docker compose up -d backend` | Plone is still starting; unlike nginx, Caddy needs no restart afterwards (it re-resolves the upstream per dial) |
| Statics load but every `/++api++` call 502s | the `reverse_proxy` upstream is wrong or unreachable — compare it against the Plone site's own conf, and check Zope is not bound to a different port or to loopback in another netns; `journalctl -u caddy` names the dial error |

Separated layout only:

| Symptom | Cause |
| --- | --- |
| Every API call fails with a JSON parse error, or `/++api++` 404s with "No backend on this origin" | the PWA was rebuilt without `VITE_API_BASE` |
| Browser console: "blocked by CORS policy" | `APP_ORIGIN` does not match the app's origin exactly — scheme, host and port all count |
| Uploads restart from zero on every retry | `Access-Control-Expose-Headers` is missing `Location` / `Upload-Offset` |
| Uploads fail at the first chunk | `PATCH` missing from `Access-Control-Allow-Methods`, or `Tus-Resumable`/`Upload-Offset` missing from the allowed request headers |
| Photos do not render at all (worked before the split) | `crossorigin="anonymous"` is on backend images now, so a missing `Access-Control-Allow-Origin` on `/++api++` breaks display, not just caching |
| Photos render online but never offline | the images are reaching the cache as opaque responses — check the images actually carry the CORS header |
