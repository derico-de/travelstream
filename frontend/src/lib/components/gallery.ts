/**
 * Shared shapes for the article gallery flow (picker <-> editor).
 *
 * `GalleryItemRef` is exactly what a `travelGallery` node stores per item —
 * uid-only references (resolveuid semantics), so gallery entries survive
 * renames and moves like every other embed.
 */

export interface GalleryItemRef {
  uid: string;
  kind: 'photo' | 'video';
  alt: string;
}

/** Where the new gallery block lands in the document. */
export type GalleryPlacement = 'top' | 'cursor' | 'end';
