"""Tests for travel-timeline REST API service."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestServiceTravelTimelineService:
    """Test travel-timeline REST API service."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_service_importable(self):
        """Test the service class can be imported."""
        from collective.travelstream.services.travel_timeline import TravelTimelineService

        assert TravelTimelineService is not None
