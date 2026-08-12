"""Testing setup for collective.travelstream."""
import os

import plone.app.theming
import plone.gallery
import plone.restapi
from plone.app.testing import FunctionalTesting
from plone.app.testing import IntegrationTesting
from plone.app.testing import PloneSandboxLayer
from plone.app.testing import SITE_OWNER_NAME
from plone.app.testing import SITE_OWNER_PASSWORD
from plone.testing.zope import WSGI_SERVER_FIXTURE

import collective.travelstream


class CollectiveTravelstreamLayer(PloneSandboxLayer):
    """Custom testing layer for collective.travelstream."""

    def setUpZope(self, app, configurationContext):
        """Set up Zope."""
        # Compile .po -> .mo so add-on translations load during tests.
        os.environ.setdefault("zope_i18n_compile_mo_files", "true")
        self.loadZCML(package=plone.app.theming)
        self.loadZCML(package=plone.gallery)
        self.loadZCML(package=plone.restapi)
        self.loadZCML(package=collective.travelstream)

    def setUpPloneSite(self, portal):
        """Set up Plone site."""
        # plone.app.testing disables the default workflow chain; restore the
        # stock Plone default so workflow behavior matches a real site.
        portal.portal_workflow.setDefaultChain("simple_publication_workflow")
        self.applyProfile(portal, "plone.restapi:default")
        self.applyProfile(portal, "collective.travelstream:default")


FIXTURE = CollectiveTravelstreamLayer()

INTEGRATION_TESTING = IntegrationTesting(
    bases=(FIXTURE,),
    name="CollectiveTravelstreamLayer:IntegrationTesting",
)

# Includes the WSGI server so REST API tests can use real HTTP sessions
# (the backend test seam is the plone.restapi HTTP layer).
FUNCTIONAL_TESTING = FunctionalTesting(
    bases=(FIXTURE, WSGI_SERVER_FIXTURE),
    name="CollectiveTravelstreamLayer:FunctionalTesting",
)

ACCEPTANCE_TESTING = FunctionalTesting(
    bases=(FIXTURE, WSGI_SERVER_FIXTURE),
    name="CollectiveTravelstreamLayer:AcceptanceTesting",
)


# Test credentials
TEST_USER_ID = "testuser"
TEST_USER_NAME = "testuser"
SITE_OWNER_NAME = SITE_OWNER_NAME
SITE_OWNER_PASSWORD = SITE_OWNER_PASSWORD
