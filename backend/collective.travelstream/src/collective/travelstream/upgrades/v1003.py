"""Article lead image."""
import logging

from .base import reload_gs_profile


logger = logging.getLogger(__name__)


def upgrade(context):
    """Add the plone.leadimage behavior to Document.

    Articles (stock Document) get a cover image and keep their existing
    Dublin Core description; both become editable from the PWA. The
    behavior lands via the reloaded types profile — existing articles
    simply have no image until one is set.

    Upgrade from profile version 1002 to 1003.
    """
    logger.info("Running upgrade step: Article lead image")
    reload_gs_profile(context)
