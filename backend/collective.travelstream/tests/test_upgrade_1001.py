"""Tests for upgrade step 1000 -> 1001 (article workflow + timeline)."""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.behaviors.itravelcaptured import ITravelCaptured
from collective.travelstream.testing import INTEGRATION_TESTING


class TestUpgrade1001:
    """Test upgrade to version 1001."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def _simulate_pre_1001(self):
        """Roll the site back to the 1000 state for Document."""
        fti = self.portal.portal_types["Document"]
        fti.behaviors = tuple(
            b for b in fti.behaviors if b != "collective.travelstream.captured"
        )
        self.portal.portal_workflow.setChainForPortalTypes(
            ("Document",), ("simple_publication_workflow",)
        )

    def test_upgrade_handler_importable(self):
        """Test the upgrade handler can be imported."""
        from collective.travelstream.upgrades.v1001 import upgrade

        assert callable(upgrade)

    def test_upgrade_repairs_workflow_and_timeline_membership(self):
        from collective.travelstream.upgrades.v1001 import upgrade

        self._simulate_pre_1001()
        trip = api.content.create(
            container=self.portal.trips, type="Trip", title="Legacy trip"
        )
        article = api.content.create(
            container=trip, type="Document", title="Old article"
        )

        upgrade(self.portal.portal_setup)

        # Document is rebound to the travel workflow
        chain = self.portal.portal_workflow.getChainForPortalType("Document")
        assert chain == ("travelstream_workflow",)

        # The pre-existing article joined the timeline: it provides the
        # marker again and the catalog reindex made it findable by it.
        assert ITravelCaptured.providedBy(article)
        catalog = api.portal.get_tool("portal_catalog")
        brains = catalog(
            object_provides=ITravelCaptured.__identifier__,
            path="/".join(trip.getPhysicalPath()),
        )
        assert [b.Title for b in brains] == ["Old article"]

        # And it is publishable through the travel workflow
        api.content.transition(obj=article, transition="publish")
        assert api.content.get_state(article) == "published"
