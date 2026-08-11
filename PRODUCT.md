# Product

## Register

product

## Platform

web

## Users

A two-person household of travellers (the site owner and their partner) capturing photos, short videos, and notes on their phones while on the road — often offline or on flaky hotel Wi-Fi — and later curating those captures into articles from a laptop or tablet. "Capture" mostly means picking existing photos and videos from the phone's gallery and filing them to a trip, not shooting live through the app; the camera is one option inside the picker, not the flow. The same people are both users and administrators; it is self-hosted personal infrastructure, not a multi-tenant service. A second audience sees a different surface: friends and family who read the published travel blog (rendered by the Plone backend, not the PWA) without ever logging in.

## Product Purpose

Travelstream turns scattered travel moments into one shared, self-hosted trip archive and, from there, into a published blog — without re-uploading or reconstructing anything. The PWA captures offline (outbox → resumable TUS uploads), organizes by trip, capture time, and GPS position, and edits articles whose canonical ProseMirror JSON is rendered identically in the app and on the public blog. Success looks like: nothing captured is ever lost, both partners' streams merge into one timeline and map, and a finished trip becomes blog articles in the same tool that captured it.

## Positioning

Your shared trip memory: one private, self-hosted place where both partners' photos, clips, and notes merge into one trip timeline.

## Brand Personality

Calm travel journal. Quiet, warm, unhurried — capture feels like jotting in a journal, browsing feels like leafing through an album. The petrol palette and plain typography stay in the background; the trip's own photos and words provide the color. The app never celebrates itself, never gamifies, never rushes the user.

## Anti-references

- Social media feeds: no infinite scroll mechanics, likes, stories, or engagement patterns.
- Enterprise CMS admin: no dense toolbar-heavy backoffice feel — the Plone Classic UI stays behind the curtain; the PWA is the face.
- Slick SaaS marketing: no gradients-and-gloss, no growth popups; this is a personal tool, not a pitch.

## Design Principles

1. **Capture never waits.** Every capture action completes instantly and locally; the network is an afterthought the outbox handles. No spinner may ever stand between the user and a moment.
2. **Honest about sync.** Offline is a normal state, not an error. Queue status, upload progress, and failures are always visible and always recoverable — never silent, never alarming.
3. **The trip is the interface.** The user's own photos, places, and dates carry the screen; chrome stays quiet, petrol-accented, and small. When in doubt, show the trip, not the tool.
4. **One document, every surface.** What the PWA edits is exactly what the blog renders (canonical ProseMirror JSON). No surface may fork or approximate content.
5. **Thumb-first on the road.** Primary actions live in thumb reach on a phone held one-handed in the field; curation comfort on larger screens is layered on top, not the other way around.

## Accessibility & Inclusion

Pragmatic basics, enforced as we build: WCAG AA contrast (≥4.5:1 body text), ≥44px touch targets, `prefers-reduced-motion` alternatives for all animation, and keyboard operability. No formal audit requirement.
