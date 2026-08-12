"""Tests for upgrade step 1002 -> 1003."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestUpgrade1003:
    """Test upgrade to version 1003."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_upgrade_handler_importable(self):
        """Test the upgrade handler can be imported."""
        from collective.travelstream.upgrades.v1003 import upgrade

        assert callable(upgrade)

    def test_upgrade_handler_runs(self):
        """Test the upgrade handler can be executed."""
        from collective.travelstream.upgrades.v1003 import upgrade

        setup_tool = self.portal.portal_setup
        upgrade(setup_tool)

    def test_document_has_leadimage_behavior(self):
        """Articles (Document) carry the plone.leadimage behavior."""
        fti = self.portal.portal_types["Document"]
        assert "plone.leadimage" in fti.behaviors
