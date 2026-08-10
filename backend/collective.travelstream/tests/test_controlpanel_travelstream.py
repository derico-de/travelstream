"""Tests for Travelstream control panel."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID

from collective.travelstream.testing import INTEGRATION_TESTING


class TestControlPanelTravelstream:
    """Test Travelstream control panel."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_controlpanel_registered(self):
        """Test control panel is registered."""
        controlpanel = self.portal.portal_controlpanel
        actions = [
            a.getAction(self.portal)["id"]
            for a in controlpanel.listActions()
        ]
        assert "travelstream-controlpanel" in actions

    def test_controlpanel_view(self):
        """Test control panel view is accessible."""
        from zope.component import getMultiAdapter
        from zope.publisher.browser import TestRequest

        request = TestRequest()
        view = getMultiAdapter(
            (self.portal, request),
            name="travelstream-controlpanel",
        )
        assert view is not None

    def test_restapi_controlpanel_adapter(self):
        """Test plone.restapi control panel adapter is registered."""
        from plone.restapi.interfaces import IControlpanel
        from zope.component import getMultiAdapter
        from zope.publisher.browser import TestRequest

        request = TestRequest()
        cp_adapter = getMultiAdapter(
            (self.portal, request),
            IControlpanel,
            name="travelstream-controlpanel",
        )
        assert cp_adapter is not None
