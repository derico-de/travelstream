/**
 * The constrained Travelstream node set: paragraphs, headings, lists,
 * blockquote, code block, links, basic marks, plus the two travel nodes
 * (resolveuid image figures and video embeds).
 *
 * The renderHTML output here MUST stay in lockstep with the Python
 * renderer (collective.travelstream.renderer) — parity is enforced by the
 * shared golden fixtures.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import Underline from '@tiptap/extension-underline';

/** @type {(keyof typeof PICTURE_VARIANT_BY_SCALE)[]} */
const IMAGE_SCALES = [
  'thumb',
  'mini',
  'preview',
  'teaser',
  'large',
  'larger',
  'great',
  'huge'
];
const DEFAULT_IMAGE_SCALE = 'large';
// Plone picture variant per requested scale — must stay in lockstep with
// PICTURE_VARIANT_BY_SCALE in the Python renderer. The article view expands
// data-picturevariant into a <picture>/srcset tag server-side.
const PICTURE_VARIANT_BY_SCALE = {
  thumb: 'small',
  mini: 'small',
  preview: 'small',
  teaser: 'medium',
  large: 'large',
  larger: 'large',
  great: 'large',
  huge: 'large'
};
const POSTER_SCALE = 'large';
const GALLERY_TILE_SCALE = 'teaser';
const GALLERY_LINK_SCALE = 'great';

/** resolveuid image figure with Plone scale URL. */
export const TravelImage = Node.create({
  name: 'travelImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      uid: { default: null },
      scale: { default: DEFAULT_IMAGE_SCALE },
      alt: { default: '' },
      caption: { default: null }
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-travel-image]' }];
  },

  renderHTML({ node }) {
    const { uid, alt, caption } = node.attrs;
    /** @type {keyof typeof PICTURE_VARIANT_BY_SCALE} */
    const scale = IMAGE_SCALES.includes(node.attrs.scale)
      ? node.attrs.scale
      : DEFAULT_IMAGE_SCALE;
    const img = [
      'img',
      {
        src: `resolveuid/${uid}/@@images/image/${scale}`,
        alt: alt || '',
        loading: 'lazy',
        'data-picturevariant': PICTURE_VARIANT_BY_SCALE[scale]
      }
    ];
    const children = caption
      ? [img, ['figcaption', {}, caption]]
      : [img];
    return ['figure', { class: 'travel-image' }, ...children];
  }
});

/** Video embed served from a stock File, poster from its lead image. */
export const TravelVideo = Node.create({
  name: 'travelVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      uid: { default: null },
      caption: { default: null }
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-travel-video]' }];
  },

  renderHTML({ node }) {
    const { uid, caption } = node.attrs;
    const video = [
      'video',
      {
        controls: 'controls',
        preload: 'metadata',
        // @@display-media, not @@download: attachment disposition
        // suppresses inline playback UI in Firefox.
        src: `resolveuid/${uid}/@@display-media/file`,
        poster: `resolveuid/${uid}/@@images/image/${POSTER_SCALE}`
      }
    ];
    const children = caption ? [video, ['figcaption', {}, caption]] : [video];
    return ['figure', { class: 'travel-video' }, ...children];
  }
});

/**
 * Multi-item media gallery: an ordered set of trip photos/videos rendered
 * as one grid figure. Items carry only `{uid, kind, alt}` — URLs are
 * resolveuid-based so gallery entries survive renames and moves exactly
 * like single embeds. Anything without a uid is skipped; any kind other
 * than 'video' renders as an image.
 *
 * Published markup follows the plone.gallery contract: flexbin classes for
 * the tile grid, `a.spotlight` anchors (grouped per `.spotlight-group`)
 * for zoom. Videos stay plain links, played inline by the browser via
 * `@@display-media` — the bundled Spotlight has no video support.
 */
export const TravelGallery = Node.create({
  name: 'travelGallery',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      items: { default: [] }
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-travel-gallery]' }];
  },

  renderHTML({ node }) {
    const items = Array.isArray(node.attrs.items) ? node.attrs.items : [];
    const children = [];
    for (const item of items) {
      const uid = item && typeof item === 'object' ? item.uid : null;
      if (!uid) continue;
      const img = [
        'img',
        {
          src: `resolveuid/${uid}/@@images/image/${GALLERY_TILE_SCALE}`,
          alt: item.alt || '',
          loading: 'lazy'
        }
      ];
      if (item.kind === 'video') {
        children.push([
          'a',
          {
            class: 'travel-gallery-item-video',
            href: `resolveuid/${uid}/@@display-media/file`
          },
          img,
          ['span', { class: 'travel-gallery-play', 'aria-hidden': 'true' }, '▶']
        ]);
      } else {
        const anchorAttrs = {
          class: 'spotlight',
          href: `resolveuid/${uid}/@@images/image/${GALLERY_LINK_SCALE}`,
          ...(item.alt ? { 'data-title': item.alt } : {})
        };
        children.push(['a', anchorAttrs, img]);
      }
    }
    return [
      'figure',
      { class: 'travel-gallery flexbin flexbin-margin spotlight-group' },
      ...children
    ];
  }
});

/** The full, constrained extension set for both editing surfaces. */
export const travelExtensions = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  Bold,
  Italic,
  Underline,
  Strike,
  Code,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      // Match the Python renderer: external links carry the rel;
      // TipTap applies HTMLAttributes to every link, so keep it minimal
      // and matching (renderer adds it for http(s) only; parity is
      // normalized in the fixture comparison).
      rel: 'noopener noreferrer',
      target: null,
      class: null
    }
  }),
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  CodeBlock,
  HardBreak,
  HorizontalRule,
  TravelImage,
  TravelVideo,
  TravelGallery
];
