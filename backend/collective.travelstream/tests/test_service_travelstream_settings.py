"""Tests for travelstream-settings REST API service."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestServiceTravelstreamSettingsService:
    """Test travelstream-settings REST API service."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_service_importable(self):
        """Test the service class can be imported."""
        from collective.travelstream.services.travelstream_settings import TravelstreamSettingsService

        assert TravelstreamSettingsService is not None

    def _service(self):
        from collective.travelstream.services.travelstream_settings import TravelstreamSettingsService

        service = TravelstreamSettingsService()
        service.context = self.portal
        service.request = self.layer["request"]
        return service

    def test_manager_can_add_keywords(self):
        """Managers are in plone.roles_allowed_to_add_keywords by default."""
        reply = self._service().reply()
        assert reply["can_add_keywords"] is True

    def test_member_cannot_add_keywords(self):
        """Plain members are not allowed to create new keywords."""
        setRoles(self.portal, TEST_USER_ID, ["Member"])
        reply = self._service().reply()
        assert reply["can_add_keywords"] is False
