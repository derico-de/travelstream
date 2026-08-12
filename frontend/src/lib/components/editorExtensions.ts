/**
 * PWA-side editor extensions: the shared travel schema plus node views
 * that make embeds *visible inside the editor*.
 *
 * The shared schema's renderHTML emits `resolveuid/...` relative URLs —
 * correct for the published blog, where Plone resolves them at browse
 * time, but unusable from the PWA: through the `/++api++/` proxy the
 * resolveuid redirect escapes the API prefix and lands on the SPA
 * fallback. These node views render the same DOM from the real Plone
 * scale URLs via the uid cache in $lib/media. Presentation only:
 * document JSON, renderHTML output, and renderer parity are untouched.
 */

import {
  TravelGallery,
  TravelImage,
  TravelVideo,
  travelExtensions
} from '@travelstream/tiptap-schema';
import { Extension } from '@tiptap/core';
import type { NodeViewRenderer } from '@tiptap/core';
import History from '@tiptap/extension-history';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { cachedMedia, pickScale, resolveMedia, type MediaUrls } from '$lib/media';
import type { GalleryItemRef } from './gallery';

/**
 * Apply resolved media URLs to an element: from the cache when warm,
 * after one metadata request when not. A load error refreshes the cache
 * once — hashed scale URLs go stale when an image is replaced.
 */
function applyMedia(
  target: HTMLImageElement | HTMLVideoElement,
  uid: string,
  apply: (target: HTMLImageElement | HTMLVideoElement, media: MediaUrls) => void
): void {
  target.onerror = () => {
    target.onerror = null;
    resolveMedia(uid, true).then((media) => media && apply(target, media));
  };
  const hit = cachedMedia(uid);
  if (hit) apply(target, hit);
  else resolveMedia(uid).then((media) => media && apply(target, media));
}

function figure(className: string, caption: string | null): HTMLElement {
  const dom = document.createElement('figure');
  dom.className = className;
  if (caption) {
    const figcaption = document.createElement('figcaption');
    figcaption.textContent = caption;
    dom.appendChild(figcaption);
  }
  return dom;
}

const imageNodeView: NodeViewRenderer = ({ node }) => {
  const { uid, scale, alt, caption } = node.attrs;
  const dom = figure('travel-image', caption);
  const img = document.createElement('img');
  img.alt = alt ?? '';
  img.loading = 'lazy';
  applyMedia(img, uid, (target, media) => {
    const url = pickScale(media, [scale ?? 'large', 'large', 'preview']);
    if (url) (target as HTMLImageElement).src = url;
  });
  dom.prepend(img);
  return { dom };
};

const videoNodeView: NodeViewRenderer = ({ node }) => {
  const { uid, caption } = node.attrs;
  const dom = figure('travel-video', caption);
  const video = document.createElement('video');
  video.controls = true;
  video.preload = 'metadata';
  applyMedia(video, uid, (target, media) => {
    const el = target as HTMLVideoElement;
    if (media.video) el.src = media.video;
    const poster = pickScale(media, ['large', 'preview']);
    if (poster) el.poster = poster;
  });
  dom.prepend(video);
  return { dom };
};

const galleryNodeView: NodeViewRenderer = ({ node }) => {
  const dom = document.createElement('figure');
  dom.className = 'travel-gallery';
  const items = (node.attrs.items ?? []) as GalleryItemRef[];
  for (const item of items) {
    if (!item?.uid) continue;
    // Spans, not links: tiles are not navigable inside the editor.
    const cell = document.createElement('span');
    cell.className =
      item.kind === 'video'
        ? 'travel-gallery-item travel-gallery-item-video'
        : 'travel-gallery-item';
    const img = document.createElement('img');
    img.alt = item.alt ?? '';
    img.loading = 'lazy';
    applyMedia(img, item.uid, (target, media) => {
      const url = pickScale(media, ['teaser', 'preview', 'thumb']);
      if (url) (target as HTMLImageElement).src = url;
    });
    cell.appendChild(img);
    if (item.kind === 'video') {
      const play = document.createElement('span');
      play.className = 'travel-gallery-play';
      play.setAttribute('aria-hidden', 'true');
      play.textContent = '▶';
      cell.appendChild(play);
    }
    dom.appendChild(cell);
  }
  if (dom.childElementCount === 0) {
    const empty = document.createElement('span');
    empty.className = 'travel-gallery-empty';
    empty.textContent = 'Empty gallery';
    dom.appendChild(empty);
  }
  return { dom };
};

/**
 * Keep an (empty) paragraph at the end of the document whenever the last
 * node is an atom block (video, image, gallery). Without it there is no
 * text position after the embed, so tapping below it can't place a caret.
 * Editor-only: the paragraph is real document content (renders as an
 * invisible `<p></p>` on the blog), but the *rule* lives here, not in the
 * shared schema.
 */
const trailingParagraphKey = new PluginKey('trailingParagraph');

const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',

  onCreate() {
    // Normalize documents that already end with an embed at load time;
    // the plugin below only runs on subsequent transactions.
    const { doc } = this.editor.state;
    if (doc.lastChild && doc.lastChild.type.name !== 'paragraph') {
      this.editor.commands.insertContentAt(doc.content.size, { type: 'paragraph' });
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: trailingParagraphKey,
        appendTransaction: (transactions, _oldState, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const last = state.doc.lastChild;
          if (!last || last.type.name === 'paragraph') return null;
          return state.tr.insert(
            state.doc.content.size,
            state.schema.nodes.paragraph.create()
          );
        }
      })
    ];
  }
});

const TRAVEL_NODE_NAMES = new Set([TravelImage.name, TravelVideo.name, TravelGallery.name]);

/** The shared schema with editor-only node views and behavior swapped in. */
export const editorExtensions = [
  ...travelExtensions.filter((extension) => !TRAVEL_NODE_NAMES.has(extension.name)),
  TravelImage.extend({ addNodeView: () => imageNodeView }),
  TravelVideo.extend({ addNodeView: () => videoNodeView }),
  TravelGallery.extend({ addNodeView: () => galleryNodeView }),
  // Editor-only: undo/redo lives in the PWA, not the shared schema — the
  // schema is also used for static HTML generation where history is noise.
  History,
  TrailingParagraph
];
