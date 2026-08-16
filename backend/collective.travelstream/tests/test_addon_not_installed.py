"""The add-on must have no effect in Plone sites where it is not installed.

ZCML is instance-global, so every registration in this package is visible
to *every* site of a shared Zope instance. Two mechanisms keep it inert:

- event subscribers cannot be layer-bound, so their handlers guard on
  ``addon_installed()``;
- views, REST services and the control panel are registered for the
  add-on's browser layer, which ``plone.browserlayer`` only puts on the
  request while traversing a site that has the add-on installed.

Both are exercised here: unregistering the browser layer is exactly what
the uninstall profile does, and a plain ``TestRequest`` is exactly what a
request to a site without the add-on looks like.
"""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.browserlayer.utils import register_layer
from plone.browserlayer.utils import unregister_layer
from plone.dexterity.browser.add import DefaultAddForm
from plone.dexterity.browser.edit import DefaultEditForm
from plone.namedfile.file import NamedBlobFile
from plone.namedfile.file import NamedBlobImage
from plone.rest.negotiation import lookup_service_id
from plone.z3cform.fieldsets.interfaces import IFormExtender
from zope.component import getSiteManager
from zope.component import queryMultiAdapter
from zope.interface import implementedBy
from zope.interface import Interface
from zope.publisher.browser import TestRequest
from zope.publisher.interfaces.browser import IDefaultBrowserLayer

from collective.travelstream.behaviors.itravelarticle import ITravelArticle
from collective.travelstream.interfaces import ICollectiveTravelstreamLayer
from collective.travelstream.subscribers import addon_installed
from collective.travelstream.testing import INTEGRATION_TESTING

from . import layered_request
from .test_exif import jpeg_with_exif


LAYER_NAME = "collective.travelstream"


class TestSubscribersGuardOnInstalled:
    """Test the addon_installed() guard on every subscriber."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])
        self.trip = api.content.create(
            container=self.portal,
            type="Trip",
            id="guard-trip",
            title="Guard trip",
        )

    @pytest.fixture
    def addon_uninstalled(self):
        """Drop the add-on's browser layer for the duration of a test."""
        unregister_layer(LAYER_NAME)
        yield
        register_layer(ICollectiveTravelstreamLayer, LAYER_NAME)

    def _image(self, obj_id):
        return api.content.create(
            container=self.trip,
            type="Image",
            id=obj_id,
            title=obj_id,
            image=NamedBlobImage(
                data=jpeg_with_exif(),
                filename="photo.jpg",
                contentType="image/jpeg",
            ),
        )

    def _video(self, obj_id):
        return api.content.create(
            container=self.trip,
            type="File",
            id=obj_id,
            title=obj_id,
            file=NamedBlobFile(
                data=b"not really a video",
                filename="clip.mp4",
                contentType="video/mp4",
            ),
        )

    def test_addon_installed_in_this_site(self):
        assert addon_installed() is True

    def test_addon_not_installed_without_layer(self, addon_uninstalled):
        assert addon_installed() is False

    def test_exif_is_stamped_when_installed(self):
        image = self._image("with-addon")
        assert image.captured_at is not None
        assert image.latitude is not None

    def test_exif_not_stamped_without_addon(self, addon_uninstalled):
        image = self._image("without-addon")
        assert image.captured_at is None
        assert image.latitude is None
        assert image.longitude is None

    def test_video_marked_when_installed(self):
        assert self._video("clip-with-addon").processing_status == "processing"

    def test_video_not_marked_without_addon(self, addon_uninstalled):
        assert self._video("clip-without-addon").processing_status != "processing"

    def test_article_type_change_ignored_without_addon(self, addon_uninstalled):
        from plone.dexterity.interfaces import IDexterityFTI
        from zope.component import queryUtility

        fti = queryUtility(IDexterityFTI, name="Trip")
        before = fti.allowed_content_types
        api.portal.set_registry_record(
            "collective.travelstream.article_type", "News Item"
        )
        assert fti.allowed_content_types == before

    def test_embedded_media_not_published_without_addon(self, addon_uninstalled):
        image = api.content.create(
            container=self.trip, type="Image", id="embedded", title="Embedded"
        )
        article = api.content.create(
            container=self.trip,
            type="Document",
            id="article",
            title="Article",
            embedded_entries=[api.content.get_uuid(image)],
        )
        api.content.transition(obj=article, to_state="published")
        assert api.content.get_state(image) == "private"


class TestRegistrationsBoundToLayer:
    """Views, services and the control panel need the add-on layer."""

    layer = INTEGRATION_TESTING

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])
        self.trip = api.content.create(
            container=self.portal, type="Trip", id="layer-trip", title="Layer trip"
        )

    def _service_name(self, name, method="GET"):
        """The view name plone.rest looks up when publishing a request."""
        return lookup_service_id(method, "application/json") + name

    @pytest.mark.parametrize(
        "name,method",
        [
            ("@travel-timeline", "GET"),
            ("@travel-geojson", "GET"),
        ],
    )
    def test_container_services_need_the_layer(self, name, method):
        view_name = self._service_name(name, method)
        assert (
            queryMultiAdapter((self.trip, layered_request()), name=view_name)
            is not None
        )
        assert queryMultiAdapter((self.trip, TestRequest()), name=view_name) is None

    def test_settings_service_needs_the_layer(self):
        view_name = self._service_name("@travelstream-settings")
        assert (
            queryMultiAdapter((self.portal, layered_request()), name=view_name)
            is not None
        )
        assert queryMultiAdapter((self.portal, TestRequest()), name=view_name) is None

    def test_publish_service_needs_the_layer(self):
        article = api.content.create(
            container=self.trip, type="Document", id="art", title="Art"
        )
        view_name = self._service_name("@travel-publish", "POST")
        assert (
            queryMultiAdapter((article, layered_request()), name=view_name)
            is not None
        )
        assert queryMultiAdapter((article, TestRequest()), name=view_name) is None

    def test_display_media_view_needs_the_layer(self):
        image = api.content.create(
            container=self.trip, type="Image", id="pic", title="Pic"
        )
        assert (
            queryMultiAdapter((image, layered_request()), name="display-media")
            is not None
        )
        assert queryMultiAdapter((image, TestRequest()), name="display-media") is None

    @pytest.mark.parametrize(
        "context_iface,form_class,name",
        [
            (
                ITravelArticle,
                DefaultEditForm,
                "collective.travelstream.omit_richtext_edit",
            ),
            (
                Interface,
                DefaultAddForm,
                "collective.travelstream.omit_richtext_add",
            ),
        ],
    )
    def test_form_extenders_need_the_layer(self, context_iface, form_class, name):
        """The add extender adapts *any* context -- without the layer it
        would run on every Dexterity add form in the instance."""
        adapters = getSiteManager().adapters

        def lookup(request_layer):
            return adapters.lookup(
                (context_iface, request_layer, implementedBy(form_class)),
                IFormExtender,
                name=name,
            )

        assert lookup(ICollectiveTravelstreamLayer) is not None
        assert lookup(IDefaultBrowserLayer) is None
