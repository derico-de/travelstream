# Agent instructions

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Design context

`PRODUCT.md` (repo root) holds strategy: users, positioning, personality, anti-references, design principles. `DESIGN.md` (repo root) holds the visual system: the Harbor Teal palette, type scale, elevation and component doctrine. Read both before designing or changing UI; the frontend's design tokens live in `frontend/src/routes/+layout.svelte` (`:root` custom properties).
