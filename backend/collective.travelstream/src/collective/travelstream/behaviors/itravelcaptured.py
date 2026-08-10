"""ITravelCaptured behavior.

The behavior interface itself is the marker (queryable via ``object_provides``)
that makes an object a travel timeline member — the timeline never enumerates portal_types.
"""

from collective.travelstream import _
from plone.autoform.interfaces import IFormFieldProvider
from plone.supermodel import model
from zope import schema
from zope.interface import provider


@provider(IFormFieldProvider)
class ITravelCaptured(model.Schema):
    """Capture time of a travel object.

    ``captured_at`` is when the moment happened (EXIF for photos, client
    clock for notes) — distinct from Plone's created/effective dates.
    Fallback when unset is the creation time (applied by the indexer and
    serializer, not stored).
    """

    captured_at = schema.Datetime(
        title=_("Captured at"),
        description=_(
            "When this moment was captured. Falls back to the upload time "
            "when left empty."
        ),
        required=False,
    )
