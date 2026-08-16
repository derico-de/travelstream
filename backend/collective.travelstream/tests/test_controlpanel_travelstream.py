"""Tests for Travelstream control panel."""
import pytest
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.restapi.controlpanels.interfaces import IControlpanel
from zope.component import getMultiAdapter
from zope.component import queryMultiAdapter
from zope.publisher.browser import TestRequest

from collective.travelstream.testing import INTEGRATION_TESTING

from . import layered_request


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
        view = getMultiAdapter(
            (self.portal, layered_request()),
            name="travelstream-controlpanel",
        )
        assert view is not None

    def test_restapi_controlpanel_adapter(self):
        """Test plone.restapi control panel adapter is registered."""
        cp_adapter = queryMultiAdapter(
            (self.portal, layered_request()),
            IControlpanel,
        )
        assert cp_adapter is not None

    def test_controlpanel_absent_without_addon_layer(self):
        """Neither the form nor the REST panel leaks into other sites."""
        request = TestRequest()
        assert (
            queryMultiAdapter(
                (self.portal, request), name="travelstream-controlpanel"
            )
            is None
        )
        assert queryMultiAdapter((self.portal, request), IControlpanel) is None
