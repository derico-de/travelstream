"""Tests for ITravelArticle behavior."""

from collective.travelstream.behaviors.itravelarticle import ITravelArticle
from plone.behavior.interfaces import IBehavior
from zope.component import getUtility

import pytest


class TestBehaviorTravelArticle:
    """Test ITravelArticle behavior."""

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]

    def test_behavior_registered(self):
        """Test behavior is registered."""
        behavior = getUtility(IBehavior, name="collective.travelstream.article")
        assert behavior is not None
        assert behavior.title

    def test_behavior_marker(self):
        """The schema interface itself is the queryable marker."""
        behavior = getUtility(IBehavior, name="collective.travelstream.article")
        assert behavior.marker == ITravelArticle

    def test_enabled_on_document_by_default(self, get_behaviors):
        assert "collective.travelstream.article" in get_behaviors("Document")
