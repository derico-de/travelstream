"""Article workflow and timeline membership."""
import logging

from collective.travelstream.kinds import article_portal_type
from plone import api

from .base import reload_gs_profile

logger = logging.getLogger(__name__)


def upgrade(context):
    """Bind Document to travelstream_workflow and add the captured behavior.

    Articles become publishable from the PWA (the stock
    simple_publication_workflow guards publish behind "Review portal
    content") and travel timeline members (ITravelCaptured marker).

    Upgrade from profile version 1000 to 1001.
    """
    logger.info("Running upgrade step: Article workflow and timeline membership")
    reload_gs_profile(context)

    # The chain change only affects existing articles once their security
    # mappings reflect the new workflow's states.
    workflow_tool = api.portal.get_tool("portal_workflow")
    count = workflow_tool.updateRoleMappings()
    logger.info("updated role mappings on %s objects", count)

    # Existing articles predate the captured behavior: refresh the marker
    # (object_provides) and capture-time index so they join the timeline.
    catalog = api.portal.get_tool("portal_catalog")
    for brain in catalog.unrestrictedSearchResults(
        portal_type=article_portal_type()
    ):
        obj = brain.getObject()
        obj.reindexObject(idxs=["object_provides", "captured_at", "review_state"])
    logger.info("reindexed existing articles for timeline membership")
