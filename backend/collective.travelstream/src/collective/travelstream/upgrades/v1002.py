"""Use plone.gallery and drop the bundled theme."""
import logging

from plone import api

from .base import reload_gs_profile


logger = logging.getLogger(__name__)

_TRAVELSTREAM_RULES = "/++theme++travelstream/rules.xml"


def upgrade(context):
    """Install plone.gallery for gallery grid and zoom, revert active theme to Barceloneta

    The bundled Diazo theme was removed from the package: sites that still
    have it active would break once its resources disappear, so fall back
    to Barceloneta. Gallery layout and zoom now come from plone.gallery
    (flexbin + Spotlight), pulled in as a new profile dependency.

    Upgrade from profile version 1001 to 1002.
    """
    logger.info("Running upgrade step: Use plone.gallery and drop the bundled theme")

    rules = api.portal.get_registry_record(
        "plone.app.theming.interfaces.IThemeSettings.rules", default=None
    )
    if rules == _TRAVELSTREAM_RULES:
        from plone.app.theming.utils import applyTheme
        from plone.app.theming.utils import getTheme

        applyTheme(getTheme("barceloneta"))
        logger.info("reverted active theme from travelstream to barceloneta")

    # Profile reload does not pull in new profile dependencies; install
    # plone.gallery explicitly for existing sites.
    setup = api.portal.get_tool("portal_setup")
    setup.runAllImportStepsFromProfile("profile-plone.gallery:default")
    logger.info("installed plone.gallery")

    reload_gs_profile(context)
