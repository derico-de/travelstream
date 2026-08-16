"""mark_video_processing event handler.

Marks video Files inside a Trip as ``processing`` so the ffmpeg worker
picks them up. Runs synchronously but does no media work — upload stays
fast; poster frame and faststart remux happen in the worker container.
"""

import logging

from collective.travelstream.content.trip import ITrip
from collective.travelstream.subscribers import addon_installed


logger = logging.getLogger("collective.travelstream")


def _inside_trip(obj):
    parent = getattr(obj, "aq_parent", None)
    while parent is not None:
        if ITrip.providedBy(parent):
            return True
        parent = getattr(parent, "aq_parent", None)
    return False


def handler(obj, event):
    """Handle ``IObjectAddedEvent`` for ``IFile``."""
    if not addon_installed():
        return
    if not _inside_trip(obj):
        return
    file_field = getattr(obj, "file", None)
    content_type = getattr(file_field, "contentType", "") or ""
    if not content_type.startswith("video/"):
        return
    obj.processing_status = "processing"
    obj.processing_error = None
    obj.reindexObject(idxs=["processing_status"])
    logger.info("mark_video_processing: %s queued for the media worker",
                obj.absolute_url())
