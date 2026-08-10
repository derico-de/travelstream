"""@travel-geojson REST API service.

GeoJSON FeatureCollection of a container's geolocated travel captures.
Accepts the same filters as @travel-timeline (captured_after/
captured_before, kind, bbox); objects without coordinates are omitted.
Clustering is client-side in MapLibre — this returns plain features.
"""

from collective.travelstream.kinds import derived_kind
from plone import api
from plone.base.interfaces import IImageScalesAdapter
from plone.restapi.serializer.converters import json_compatible
from plone.restapi.services import Service
from zope.component import queryMultiAdapter

from .travel_timeline import BadRequest
from .travel_timeline import build_capture_query


def _thumbnail_url(obj, request, summary_scales):
    """Smallest useful scale URL for a map marker, or None."""
    for field_scales in summary_scales.values():
        if not field_scales:
            continue
        entry = field_scales[0]
        scales = entry.get("scales", {})
        preferred = scales.get("thumb") or scales.get("mini") or scales.get("preview")
        download = (preferred or entry).get("download")
        if download:
            return f"{obj.absolute_url()}/{download}"
    return None


class TravelGeojsonService(Service):
    """GeoJSON FeatureCollection of geolocated travel captures.

    Endpoint: @travel-geojson
    """

    def reply(self):
        try:
            query = build_capture_query(self.context, self.request.form)
        except BadRequest as error:
            self.request.response.setStatus(400)
            return {"error": {"type": "BadRequest", "message": str(error)}}

        # Only geolocated objects: latitude/longitude indexes only contain
        # objects with coordinates, so an open range restricts to them.
        query.setdefault("latitude", {"query": [-90.0, 90.0], "range": "min:max"})
        query.setdefault("longitude", {"query": [-180.0, 180.0], "range": "min:max"})

        catalog = api.portal.get_tool("portal_catalog")
        features = []
        for brain in catalog(**query):
            obj = brain.getObject()
            latitude = getattr(obj, "latitude", None)
            longitude = getattr(obj, "longitude", None)
            if latitude is None or longitude is None:
                continue

            scales_adapter = queryMultiAdapter(
                (obj, self.request), IImageScalesAdapter
            )
            scales = scales_adapter() if scales_adapter is not None else {}

            captured = getattr(obj, "captured_at", None)
            if captured is None:
                captured = obj.created().asdatetime()

            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [longitude, latitude],
                    },
                    "properties": {
                        "@id": obj.absolute_url(),
                        "uid": brain.UID,
                        "title": obj.Title(),
                        "kind": derived_kind(obj.portal_type),
                        "captured_at": json_compatible(captured),
                        "thumbnail": _thumbnail_url(obj, self.request, scales),
                    },
                }
            )

        return {"type": "FeatureCollection", "features": features}
