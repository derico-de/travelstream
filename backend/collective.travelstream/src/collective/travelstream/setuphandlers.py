"""Setup handlers for collective.travelstream."""

import logging

from plone import api
from plone.base.interfaces import INonInstallable
from Products.CMFPlone.interfaces.syndication import IFeedSettings
from zope.interface import implementer


logger = logging.getLogger("collective.travelstream")

BLOG_ID = "blog"


@implementer(INonInstallable)
class HiddenProfiles:
    """Hidden profiles from the Plone add-ons control panel."""

    def getNonInstallableProfiles(self):
        """Return list of profiles that should not be available for install."""
        return [
            "collective.travelstream:uninstall",
        ]


def post_install(context):
    """Create the public blog collection (idempotent)."""
    portal = api.portal.get()
    if BLOG_ID in portal:
        return

    blog = api.content.create(
        container=portal,
        type="Collection",
        id=BLOG_ID,
        title="Blog",
        description="Published travel articles",
    )
    blog.query = [
        {
            "i": "portal_type",
            "o": "plone.app.querystring.operation.selection.any",
            "v": ["Document"],
        },
        {
            "i": "review_state",
            "o": "plone.app.querystring.operation.selection.any",
            "v": ["published"],
        },
    ]
    blog.sort_on = "effective"
    blog.sort_reversed = True
    blog.setLayout("summary_view")

    # Keep-in-place blog: the collection lists published articles wherever
    # they live; publishing the collection itself makes /blog public.
    if api.content.get_state(blog, default=None) != "published":
        try:
            api.content.transition(obj=blog, transition="publish")
        except api.exc.InvalidParameterError:
            logger.warning("could not publish the blog collection")

    # Syndication (RSS) for the listing
    feed = IFeedSettings(blog, None)
    if feed is not None:
        feed.enabled = True

    blog.reindexObject()
    logger.info("created public blog collection at /%s", BLOG_ID)


def uninstall(context):
    """Uninstall script."""
