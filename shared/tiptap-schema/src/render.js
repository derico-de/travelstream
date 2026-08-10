/**
 * Render a ProseMirror JSON document to HTML with the shared schema.
 * Used by the parity test suite and available to the PWA for previews.
 */

import { generateHTML } from '@tiptap/html';

import { travelExtensions } from './schema.js';

export function renderToHTML(doc) {
  if (!doc || typeof doc !== 'object') return '';
  return generateHTML(doc, travelExtensions);
}
