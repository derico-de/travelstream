"""Tests for Trip content type."""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.dexterity.interfaces import IDexterityFTI
from zope.component import queryUtility

from collective.travelstream.testing import INTEGRATION_TESTING


class TestContentTypeTrip:
    """Test Trip content type."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])
        # Globally addable: create directly in the portal root.
        self.container = self.portal

    def test_fti(self):
        """Test FTI is installed."""
        fti = queryUtility(IDexterityFTI, name="Trip")
        assert fti is not None

    def test_fti_title(self):
        """Test FTI title."""
        fti = queryUtility(IDexterityFTI, name="Trip")
        assert fti.title == "Trip"

    def test_schema(self):
        """Test schema interface."""
        fti = queryUtility(IDexterityFTI, name="Trip")
        schema = fti.lookupSchema()
        assert schema.getName() == "ITrip"

    def test_factory(self):
        """Test content factory."""
        obj = api.content.create(
            container=self.container,
            type="Trip",
            id="test-trip",
            title="Test Trip",
        )
        assert obj is not None
        assert obj.portal_type == "Trip"

    def test_adding(self):
        """Test content can be added."""
        obj = api.content.create(
            container=self.container,
            type="Trip",
            id="test-trip",
            title="Test Trip",
        )
        assert obj.id == "test-trip"

    def test_deleting(self):
        """Test content can be deleted."""
        obj = api.content.create(
            container=self.container,
            type="Trip",
            id="test-trip",
            title="Test Trip",
        )
        api.content.delete(obj=obj)
        assert "test-trip" not in self.container.objectIds()

    def test_global_allow(self):
        """Test content type global_allow setting."""
        fti = queryUtility(IDexterityFTI, name="Trip")
        assert fti.global_allow is True
