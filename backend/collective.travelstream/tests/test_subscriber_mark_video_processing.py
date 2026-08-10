"""Tests for mark_video_processing event subscriber."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestSubscriberMarkVideoProcessing:
    """Test mark_video_processing subscriber."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_handler_importable(self):
        """Test the handler function can be imported."""
        from collective.travelstream.subscribers.mark_video_processing import handler

        assert callable(handler)
