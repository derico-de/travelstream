# Travelstream

A PWA for capturing photos, videos and notes during a trip and publishing them
from a Plone backend. Capture happens away from a keyboard and often offline;
curation happens at home afterwards.

## Language

### Trips and content

**Trip**:
The journey a piece of content is filed under. Every capture belongs to exactly
one, or waits locally until one is assigned.
_Avoid_: Journey, album, collection

### Capture and upload

**Capture**:
Recording a moment in the field with the app itself — the camera, the recorder,
the note editor. Under time pressure and possibly offline.
_Avoid_: Shoot, record (as nouns)

**Import**:
Bringing media that already exists elsewhere into a Trip — from Immich by share
sheet on Android, or by file picker on the laptop. Deliberately not a Capture:
it happens at home, online, at leisure, and in bulk.
_Avoid_: Ingest, sync, upload (for this sense)

**Outbox**:
The local queue of items awaiting upload to Plone. Survives restarts, so a
committed item is never lost.
_Avoid_: Queue, spool

**Staged**:
The Outbox state of an item that is persisted but deliberately held from
upload, because its details are still being reviewed.
_Avoid_: Draft, pending

### Media

**Original**:
The full-size file as it left the camera or Immich. Immich is the archive of
record for these; Travelstream never keeps one permanently.
_Avoid_: Source, master, raw

**Derivative**:
The downscaled JPEG that Travelstream stores — bounded by a configurable
longest edge, carrying no embedded metadata. The only form of a photo that
reaches Plone, and the only form the Outbox holds.
_Avoid_: Resized copy, thumbnail (a thumbnail is a display size, not this)

**Held**:
A file that arrived in an Import and was accepted, but has no path forward yet —
today only video. It waits in the Share inbox and is never presented as an error;
the user chose it deliberately.
_Avoid_: Pending, deferred, unsupported

**Skipped**:
A file the browser cannot decode at all, so no Derivative can exist for it. Not a
refusal — Travelstream never declines a file the user chose, it only reports the
ones it physically cannot read.
_Avoid_: Rejected, refused, failed, unsupported

**Share inbox**:
The holding area a share sheet delivers files into, before they become Outbox
items. It is what makes an Import resumable: an un-imported file is one still
sitting here.
_Avoid_: Share cache, staging area
