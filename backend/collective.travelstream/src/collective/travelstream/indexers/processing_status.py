"""processing_status catalog indexer (the worker's polling query)."""

from collective.travelstream.behaviors.itravelprocessing import ITravelProcessing
from plone.dexterity.interfaces import IDexterityContent
from plone.indexer import indexer


@indexer(IDexterityContent)
def dummy(obj):
    """Guard: prevent this indexer leaking to other content via acquisition."""
    raise AttributeError("This field should not be indexed here!")


@indexer(ITravelProcessing)
def processing_status(obj):
    """Only objects with an actual status land in the index."""
    value = getattr(obj, "processing_status", None)
    if not value:
        raise AttributeError("No processing status")
    return value
