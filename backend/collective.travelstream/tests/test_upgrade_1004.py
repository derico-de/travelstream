"""Tests for upgrade step 1003 -> 1004."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestUpgrade1004:
    """Test upgrade to version 1004."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_upgrade_handler_importable(self):
        """Test the upgrade handler can be imported."""
        from collective.travelstream.upgrades.v1004 import upgrade

        assert callable(upgrade)

    def test_upgrade_handler_runs(self):
        """Test the upgrade handler can be executed."""
        from collective.travelstream.upgrades.v1004 import upgrade

        setup_tool = self.portal.portal_setup
        upgrade(setup_tool)

    def test_trip_is_not_a_navigation_root(self):
        """Trips no longer carry the plone.navigationroot behavior."""
        fti = self.portal.portal_types["Trip"]
        assert "plone.navigationroot" not in fti.behaviors

    def test_upgrade_strips_behavior_from_existing_fti(self):
        """The handler removes the behavior even when an old site still has it."""
        from collective.travelstream.upgrades.v1004 import upgrade

        fti = self.portal.portal_types["Trip"]
        fti.behaviors = tuple(fti.behaviors) + ("plone.navigationroot",)

        upgrade(self.portal.portal_setup)

        assert "plone.navigationroot" not in fti.behaviors
