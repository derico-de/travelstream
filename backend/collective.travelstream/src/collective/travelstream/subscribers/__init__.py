"""Event subscribers for collective.travelstream.

Subscribers are registered globally in ZCML, so they fire in *every* Plone
site of the Zope instance -- including sites where this add-on was never
installed. Every handler therefore starts with an ``addon_installed()``
guard, otherwise a shared instance would see unrelated sites break on our
schema fields, our registry records and our content types.
"""

from collective.travelstream.interfaces import ICollectiveTravelstreamLayer
from plone.browserlayer.utils import registered_layers


def addon_installed():
    """True when this add-on is installed in the site being used right now.

    The browser layer is registered as a *local* utility by the
    ``browserlayer`` GenericSetup step on install, and unregistered again
    on uninstall, so its presence in the current site's component registry
    answers "is the add-on installed here?".

    Do not check ``ICollectiveTravelstreamLayer.providedBy(request)``
    instead: ``plone.browserlayer`` only marks the request while traversing
    a site root, so the layer is missing in upgrade steps, scripts, async
    workers and integration tests -- contexts in which the handlers must
    still run.
    """
    return ICollectiveTravelstreamLayer in registered_layers()
