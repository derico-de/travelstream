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
const POSTER_SCALE = 'large';

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
    const scale = IMAGE_SCALES.includes(node.attrs.scale)
      ? node.attrs.scale
      : DEFAULT_IMAGE_SCALE;
    const img = [
      'img',
      {
        src: `resolveuid/${uid}/@@images/image/${scale}`,
        alt: alt || '',
        loading: 'lazy'
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
        src: `resolveuid/${uid}/@@download/file`,
        poster: `resolveuid/${uid}/@@images/image/${POSTER_SCALE}`
      }
    ];
    const children = caption ? [video, ['figcaption', {}, caption]] : [video];
    return ['figure', { class: 'travel-video' }, ...children];
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
  TravelVideo
];
