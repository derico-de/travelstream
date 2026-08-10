"""Tests for ITravelGeolocation behavior."""

from collective.travelstream.behaviors.itravelgeolocation import ITravelGeolocation
from plone.behavior.interfaces import IBehavior
from zope.component import getUtility

import pytest


class TestBehaviorTravelGeolocation:
    """Test ITravelGeolocation behavior."""

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]

    def test_behavior_registered(self):
        """Test behavior is registered."""
        behavior = getUtility(IBehavior, name="collective.travelstream.geolocation")
        assert behavior is not None
        assert behavior.title

    def test_behavior_marker(self):
        """The schema interface itself is the queryable marker."""
        behavior = getUtility(IBehavior, name="collective.travelstream.geolocation")
        assert behavior.marker == ITravelGeolocation
