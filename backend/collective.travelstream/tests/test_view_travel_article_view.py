"""Tests for TravelArticleView view."""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from zope.component import getMultiAdapter
from zope.component import queryMultiAdapter
from zope.publisher.browser import TestRequest

from collective.travelstream.testing import INTEGRATION_TESTING

from . import layered_request


class TestViewTravelArticleView:
    """Test TravelArticleView view."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])
        self.context = api.content.create(
            container=self.portal,
            type="Document",
            id="test-document",
            title="Test Document",
        )

    def test_view_registered(self):
        """Test view is registered."""
        view = getMultiAdapter(
            (self.context, layered_request()),
            name="travel-article-view",
        )
        assert view is not None

    def test_view_name(self):
        """Test view __name__."""
        view = getMultiAdapter(
            (self.context, layered_request()),
            name="travel-article-view",
        )
        assert view.__name__ == "travel-article-view"

    def test_view_absent_without_addon_layer(self):
        """The view must not exist in sites without the add-on installed."""
        view = queryMultiAdapter(
            (self.context, TestRequest()),
            name="travel-article-view",
        )
        assert view is None
