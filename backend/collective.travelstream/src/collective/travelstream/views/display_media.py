"""@@display-media: inline delivery for article media.

plone.namedfile's @@download always sends ``Content-Disposition:
attachment``, and its @@display-file only serves an *allowlist* of
mimetypes inline — video is not on it, so both fall back to attachment.
Firefox refuses inline playback UI for attachment-flagged media: a
``<video>`` embed shows no controls and only plays via the context menu.

This view is @@display-file with the article media types added to the
allowlist, so ``<video>`` embeds stream inline (Range requests included,
inherited from Download). The security purpose of the allowlist —
keeping active content like text/html and SVG from rendering in the
site's origin — is untouched.
"""

from plone.namedfile.browser import ALLOWED_INLINE_MIMETYPES
from plone.namedfile.browser import DisplayFile


INLINE_MEDIA_MIMETYPES = ALLOWED_INLINE_MIMETYPES + [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
]


class DisplayMedia(DisplayFile):
    """Serve article media inline; everything else behaves like @@display-file."""

    allowed_inline_mimetypes = INLINE_MEDIA_MIMETYPES
