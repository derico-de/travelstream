"""Tests for extract_exif_metadata event subscriber."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestSubscriberExtractExifMetadata:
    """Test extract_exif_metadata subscriber."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_handler_importable(self):
        """Test the handler function can be imported."""
        from collective.travelstream.subscribers.extract_exif_metadata import handler

        assert callable(handler)
