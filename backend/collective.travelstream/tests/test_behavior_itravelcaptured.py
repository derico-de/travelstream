"""Tests for ITravelCaptured behavior."""

from collective.travelstream.behaviors.itravelcaptured import ITravelCaptured
from plone.behavior.interfaces import IBehavior
from zope.component import getUtility

import pytest


class TestBehaviorTravelCaptured:
    """Test ITravelCaptured behavior."""

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]

    def test_behavior_registered(self):
        """Test behavior is registered."""
        behavior = getUtility(IBehavior, name="collective.travelstream.captured")
        assert behavior is not None
        assert behavior.title

    def test_behavior_marker(self):
        """The schema interface itself is the queryable marker."""
        behavior = getUtility(IBehavior, name="collective.travelstream.captured")
        assert behavior.marker == ITravelCaptured
