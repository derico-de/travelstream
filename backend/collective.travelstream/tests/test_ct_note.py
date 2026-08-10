"""Tests for Note content type."""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.dexterity.interfaces import IDexterityFTI
from zope.component import queryUtility

from collective.travelstream.testing import INTEGRATION_TESTING


class TestContentTypeNote:
    """Test Note content type."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])
        # Not globally addable: create a Trip
        # parent that allows this type, and add inside it.
        self.container = api.content.create(
            container=self.portal,
            type="Trip",
            id="parent-container",
            title="Parent Container",
        )

    def test_fti(self):
        """Test FTI is installed."""
        fti = queryUtility(IDexterityFTI, name="Note")
        assert fti is not None

    def test_fti_title(self):
        """Test FTI title."""
        fti = queryUtility(IDexterityFTI, name="Note")
        assert fti.title == "Note"

    def test_schema(self):
        """Test schema interface."""
        fti = queryUtility(IDexterityFTI, name="Note")
        schema = fti.lookupSchema()
        assert schema.getName() == "INote"

    def test_factory(self):
        """Test content factory."""
        obj = api.content.create(
            container=self.container,
            type="Note",
            id="test-note",
            title="Test Note",
        )
        assert obj is not None
        assert obj.portal_type == "Note"

    def test_adding(self):
        """Test content can be added."""
        obj = api.content.create(
            container=self.container,
            type="Note",
            id="test-note",
            title="Test Note",
        )
        assert obj.id == "test-note"

    def test_deleting(self):
        """Test content can be deleted."""
        obj = api.content.create(
            container=self.container,
            type="Note",
            id="test-note",
            title="Test Note",
        )
        api.content.delete(obj=obj)
        assert "test-note" not in self.container.objectIds()

    def test_global_allow(self):
        """Test content type global_allow setting."""
        fti = queryUtility(IDexterityFTI, name="Note")
        assert fti.global_allow is False

    def test_addable_in_parent(self):
        """Test the type is addable inside its Trip parent."""
        addable = [
            fti.getId() for fti in self.container.allowedContentTypes()
        ]
        assert "Note" in addable
