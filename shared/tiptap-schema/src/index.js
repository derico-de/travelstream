/**
 * Shared TipTap schema for Travelstream.
 *
 * ONE schema, two surfaces: the PWA editor and the (future, ticket 19)
 * Classic UI widget both consume these extensions, so the two editing
 * surfaces cannot drift apart. The Python renderer is held to this schema
 * by the golden fixtures in ../prosemirror-fixtures.
 *
 * TipTap major version: 2.x — pinned deliberately, because Patternslib's
 * pat-tiptap (the planned base for the Classic UI widget) pins TipTap 2.x.
 * Do not bump to 3.x without resolving the pat-tiptap alignment
 * (see ticket 19).
 */

export { travelExtensions, TravelImage, TravelVideo } from './schema.js';
export { renderToHTML } from './render.js';
