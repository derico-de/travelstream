"""Tests for travel-geojson REST API service."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestServiceTravelGeojsonService:
    """Test travel-geojson REST API service."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_service_importable(self):
        """Test the service class can be imported."""
        from collective.travelstream.services.travel_geojson import TravelGeojsonService

        assert TravelGeojsonService is not None
