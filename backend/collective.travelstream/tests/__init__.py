"""Test helpers for collective.travelstream."""
from zope.interface import alsoProvides
from zope.publisher.browser import TestRequest

from collective.travelstream.interfaces import ICollectiveTravelstreamLayer


def layered_request(**kw):
    """A TestRequest marked with the add-on's browser layer.

    ``plone.browserlayer`` stamps the layer on the request while traversing
    the site root, so every real request to a site with the add-on
    installed carries it. Integration tests do not traverse, so they have
    to apply it themselves before looking up a layer-bound view, service or
    adapter.
    """
    request = TestRequest(**kw)
    alsoProvides(request, ICollectiveTravelstreamLayer)
    return request
