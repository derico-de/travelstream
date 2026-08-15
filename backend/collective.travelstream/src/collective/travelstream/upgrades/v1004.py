"""Trip is no longer a navigation root."""
import logging

from plone import api

from .base import reload_gs_profile


logger = logging.getLogger(__name__)


def upgrade(context):
    """Remove the plone.navigationroot behavior from the Trip FTI.

    A trip scoped navigation to itself, hiding sibling trips. Reloading
    the profile alone is not enough: GenericSetup merges lines
    properties additively, so the behavior is stripped explicitly.

    Upgrade from profile version 1003 to 1004.
    """
    logger.info("Running upgrade step: Trip is no longer a navigation root")
    fti = api.portal.get_tool("portal_types")["Trip"]
    fti.behaviors = tuple(
        behavior for behavior in fti.behaviors
        if behavior != "plone.navigationroot"
    )
    reload_gs_profile(context)
