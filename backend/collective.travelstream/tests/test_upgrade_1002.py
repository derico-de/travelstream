"""Tests for upgrade step 1001 -> 1002."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestUpgrade1002:
    """Test upgrade to version 1002."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_upgrade_handler_importable(self):
        """Test the upgrade handler can be imported."""
        from collective.travelstream.upgrades.v1002 import upgrade

        assert callable(upgrade)

    def test_upgrade_handler_runs(self):
        """Test the upgrade handler can be executed."""
        from collective.travelstream.upgrades.v1002 import upgrade

        setup_tool = self.portal.portal_setup
        upgrade(setup_tool)
