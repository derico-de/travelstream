"""Summary serializer for travel timeline members.

Registered for the ITravelCaptured marker (never for concrete types), so
timeline/GeoJSON items are self-sufficient: derived kind, captured_at,
coordinates and thumbnail scale URLs without follow-up requests.
"""

from collective.travelstream.behaviors.itravelcaptured import ITravelCaptured
from collective.travelstream.kinds import capture_time
from collective.travelstream.kinds import derived_kind
from plone.base.interfaces import IImageScalesAdapter
from plone.restapi.interfaces import ISerializeToJsonSummary
from plone.restapi.serializer.converters import json_compatible
from plone.restapi.serializer.summary import DefaultJSONSummarySerializer
from zope.component import adapter
from zope.component import queryMultiAdapter
from zope.interface import implementer
from zope.interface import Interface


@implementer(ISerializeToJsonSummary)
@adapter(ITravelCaptured, Interface)
class TravelCapturedSummarySerializer(DefaultJSONSummarySerializer):
    """Enrich the stock summary with travel capture data."""

    def __call__(self):
        summary = super().__call__()
        obj = self.context

        summary["kind"] = derived_kind(obj.portal_type)
        summary["UID"] = obj.UID()

        summary["captured_at"] = json_compatible(capture_time(obj))

        summary["latitude"] = json_compatible(getattr(obj, "latitude", None))
        summary["longitude"] = json_compatible(getattr(obj, "longitude", None))

        scales = queryMultiAdapter((obj, self.request), IImageScalesAdapter)
        summary["image_scales"] = scales() if scales is not None else {}

        return summary
