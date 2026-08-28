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
  TravelMediaText,
  TravelVideo,
  travelExtensions
} from '@travelstream/tiptap-schema';
import { Extension } from '@tiptap/core';
import type { NodeViewRenderer } from '@tiptap/core';
import History from '@tiptap/extension-history';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

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
 * Image + rich text block. The media half is presentation (attrs-driven,
 * resolved like the other embeds); the body div is the contentDOM — the
 * first content-hole node view in the app. `update` patches attrs changes
 * (variant, caption, scale, image swap) in place so the body's editing
 * state survives them.
 */
const mediaTextNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  const dom = document.createElement('div');
  const media = document.createElement('figure');
  media.className = 'travel-media-text-media';
  const img = document.createElement('img');
  img.loading = 'lazy';
  media.appendChild(img);
  const figcaption = document.createElement('figcaption');
  const body = document.createElement('div');
  body.className = 'travel-media-text-body';
  dom.append(media, body);

  // The media half is not editable content: a press selects the block,
  // which surfaces the variant/scale controls in the toolbar.
  media.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (pos !== undefined) editor.commands.setNodeSelection(pos);
  });

  let shown = { uid: null as string | null, scale: null as string | null };

  const sync = (current: typeof node) => {
    const { uid, scale, alt, caption, variant } = current.attrs;
    dom.className = `travel-media-text travel-media-text--${variant ?? 'image-left'}`;
    img.alt = alt ?? '';
    if (caption) {
      figcaption.textContent = caption;
      if (!figcaption.parentNode) media.appendChild(figcaption);
    } else {
      figcaption.remove();
    }
    if (uid && (uid !== shown.uid || scale !== shown.scale)) {
      shown = { uid, scale };
      applyMedia(img, uid, (target, urls) => {
        const url = pickScale(urls, [scale ?? 'large', 'large', 'preview']);
        if (url) (target as HTMLImageElement).src = url;
      });
    }
  };
  sync(node);

  return {
    dom,
    contentDOM: body,
    update(updated) {
      if (updated.type !== node.type) return false;
      sync(updated);
      return true;
    }
  };
};

/**
 * Editor-only hint on a media-text block whose body is still one empty
 * paragraph: styled via .travel-media-text-placeholder::before. A node
 * decoration, so it never touches document content.
 */
const mediaTextPlaceholderKey = new PluginKey('mediaTextPlaceholder');

const MediaTextPlaceholder = Extension.create({
  name: 'mediaTextPlaceholder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mediaTextPlaceholderKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== TravelMediaText.name) return true;
              const first = node.firstChild;
              if (
                node.childCount === 1 &&
                first &&
                first.type.name === 'paragraph' &&
                first.content.size === 0
              ) {
                decorations.push(
                  Decoration.node(pos + 1, pos + 1 + first.nodeSize, {
                    class: 'travel-media-text-placeholder'
                  })
                );
              }
              return false;
            });
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

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

const TRAVEL_NODE_NAMES = new Set([
  TravelImage.name,
  TravelVideo.name,
  TravelGallery.name,
  TravelMediaText.name
]);

/** The shared schema with editor-only node views and behavior swapped in. */
export const editorExtensions = [
  ...travelExtensions.filter((extension) => !TRAVEL_NODE_NAMES.has(extension.name)),
  TravelImage.extend({ addNodeView: () => imageNodeView }),
  TravelVideo.extend({ addNodeView: () => videoNodeView }),
  TravelGallery.extend({ addNodeView: () => galleryNodeView }),
  TravelMediaText.extend({ addNodeView: () => mediaTextNodeView }),
  // Editor-only: undo/redo lives in the PWA, not the shared schema — the
  // schema is also used for static HTML generation where history is noise.
  History,
  TrailingParagraph,
  MediaTextPlaceholder
];
