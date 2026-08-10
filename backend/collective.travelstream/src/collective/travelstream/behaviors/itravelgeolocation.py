"""ITravelGeolocation behavior.

Minimal equivalent of collective.geolocationbehavior (which has no
Plone 6.1-compatible release): plain latitude/longitude fields, indexed
in the catalog, serialized as JSON numbers over plone.restapi.
"""

from collective.travelstream import _
from plone.autoform.interfaces import IFormFieldProvider
from plone.supermodel import model
from zope import schema
from zope.interface import provider


@provider(IFormFieldProvider)
class ITravelGeolocation(model.Schema):
    """Latitude/longitude position of a captured travel object."""

    latitude = schema.Float(
        title=_("Latitude"),
        description=_("Latitude in decimal degrees (WGS84)"),
        required=False,
        min=-90.0,
        max=90.0,
    )

    longitude = schema.Float(
        title=_("Longitude"),
        description=_("Longitude in decimal degrees (WGS84)"),
        required=False,
        min=-180.0,
        max=180.0,
    )
