# Shared ProseMirror golden fixtures

The same fixtures are asserted at both test seams:

- **Python renderer** (`collective.travelstream.renderer.render_document`)
  via the Plone functional layer (`backend/collective.travelstream/tests/test_article.py`)
- **TipTap `generateHTML`** with the shared schema package via Vitest
  (frontend parity suite, ticket 12)

Both must produce equivalent HTML (after whitespace normalization). A schema
change that breaks parity fails both suites. `*.json` is the ProseMirror
document, `*.html` the pinned expected output.
