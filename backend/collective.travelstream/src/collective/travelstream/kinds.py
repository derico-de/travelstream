"""Derived entry kinds.

Entry kind is derived from portal_type, never stored: serializers map
portal_type -> kind so the PWA receives a single discriminated union, and
kind filters map back to portal_type server-side.
"""

from plone import api


ARTICLE_TYPE_REGISTRY_KEY = "collective.travelstream.article_type"

_STOCK_KINDS = {
    "Image": "photo",
    "File": "video",
    "Note": "note",
}


def article_portal_type():
    """The portal_type used for travel articles (registry-configurable)."""
    try:
        value = api.portal.get_registry_record(ARTICLE_TYPE_REGISTRY_KEY)
    except api.exc.InvalidParameterError:
        value = None
    return value or "Document"


def derived_kind(portal_type):
    """Map a portal_type to its travel entry kind (or None)."""
    kind = _STOCK_KINDS.get(portal_type)
    if kind is not None:
        return kind
    if portal_type == article_portal_type():
        return "article"
    return None


def portal_types_for_kind(kind):
    """Map a kind filter value back to the portal_types it covers."""
    if kind == "article":
        return [article_portal_type()]
    return [pt for pt, k in _STOCK_KINDS.items() if k == kind]
