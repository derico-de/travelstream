"""@travel-timeline REST API service.

Batched chronological timeline of travel captures on a Trip (or any
container, e.g. the household trips folder for cross-trip queries).
Membership is the ITravelCaptured behavior marker, never a type list;
queries are path-scoped to the context.
"""

from collective.travelstream.behaviors.itravelcaptured import ITravelCaptured
from collective.travelstream.kinds import portal_types_for_kind
from plone import api
from plone.restapi.batching import HypermediaBatch
from plone.restapi.interfaces import ISerializeToJsonSummary
from plone.restapi.services import Service
from zope.component import getMultiAdapter


class BadRequest(Exception):
    """Invalid filter parameter."""


def _date_range_query(start, end):
    if start and end:
        return {"query": [start, end], "range": "min:max"}
    if start:
        return {"query": start, "range": "min"}
    return {"query": end, "range": "max"}


def build_capture_query(context, form):
    """Build the shared catalog query for timeline and GeoJSON services."""
    query = {
        "object_provides": ITravelCaptured.__identifier__,
        "path": {"query": "/".join(context.getPhysicalPath())},
        "sort_on": "captured_at",
        "sort_order": "descending",
    }

    start = form.get("captured_after")
    end = form.get("captured_before")
    if start or end:
        query["captured_at"] = _date_range_query(start, end)

    kind = form.get("kind")
    if kind:
        kinds = kind if isinstance(kind, list) else [kind]
        portal_types = []
        for k in kinds:
            portal_types.extend(portal_types_for_kind(k))
        if not portal_types:
            raise BadRequest(f"Unknown kind filter: {kinds!r}")
        query["portal_type"] = portal_types

    bbox = form.get("bbox")
    if bbox:
        try:
            minlon, minlat, maxlon, maxlat = [float(p) for p in bbox.split(",")]
        except ValueError:
            raise BadRequest(
                "bbox must be 'minlon,minlat,maxlon,maxlat' in decimal degrees"
            )
        query["latitude"] = {"query": [minlat, maxlat], "range": "min:max"}
        query["longitude"] = {"query": [minlon, maxlon], "range": "min:max"}

    return query


class TravelTimelineService(Service):
    """Batched chronological timeline of travel captures.

    Endpoint: @travel-timeline
    Filters: captured_after / captured_before (ISO dates), kind
    (photo/video/note/article, repeatable), bbox (minlon,minlat,maxlon,maxlat).
    Batching follows the standard plone.restapi contract (b_start/b_size).
    """

    def reply(self):
        try:
            query = build_capture_query(self.context, self.request.form)
        except BadRequest as error:
            self.request.response.setStatus(400)
            return {
                "error": {"type": "BadRequest", "message": str(error)},
            }

        catalog = api.portal.get_tool("portal_catalog")
        brains = catalog(**query)

        batch = HypermediaBatch(self.request, brains)
        results = {
            "@id": batch.canonical_url,
            "items_total": batch.items_total,
        }
        links = batch.links
        if links:
            results["batching"] = links
        results["items"] = [
            getMultiAdapter((brain.getObject(), self.request), ISerializeToJsonSummary)()
            for brain in batch
        ]
        return results
