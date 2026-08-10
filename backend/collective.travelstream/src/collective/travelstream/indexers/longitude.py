"""longitude catalog indexer."""

from collective.travelstream.behaviors.itravelgeolocation import ITravelGeolocation
from plone.dexterity.interfaces import IDexterityContent
from plone.indexer import indexer


@indexer(IDexterityContent)
def dummy(obj):
    """Guard: prevent this indexer leaking to other content via acquisition."""
    raise AttributeError("This field should not be indexed here!")


@indexer(ITravelGeolocation)
def longitude(obj):
    """Return the longitude; objects without coordinates stay out of the index."""
    value = getattr(obj, "longitude", None)
    if value is None:
        raise AttributeError("No longitude set")
    return value
