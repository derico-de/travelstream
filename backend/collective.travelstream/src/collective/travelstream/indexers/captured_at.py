"""captured_at catalog indexer.

DateIndex value for the capture time; falls back to the creation time so
every timeline member sorts deterministically even before metadata arrives.
"""

from collective.travelstream.behaviors.itravelcaptured import ITravelCaptured
from collective.travelstream.kinds import capture_time
from plone.dexterity.interfaces import IDexterityContent
from plone.indexer import indexer


@indexer(IDexterityContent)
def dummy(obj):
    """Guard: prevent this indexer leaking to other content via acquisition."""
    raise AttributeError("This field should not be indexed here!")


@indexer(ITravelCaptured)
def captured_at(obj):
    """Return the capture time, falling back to the creation time."""
    return capture_time(obj)
