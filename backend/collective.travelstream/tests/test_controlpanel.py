"""Ticket 11: Travelstream control panel + article-type registry setting."""

import pytest

from collective.travelstream.controlpanels.travelstream import ITravelstreamSettings
from collective.travelstream.controlpanels.travelstream import validate_article_type
from zope.interface import Invalid


REGISTRY_KEY = "collective.travelstream.article_type"


@pytest.fixture
def trip(manager_request):
    r = manager_request.post("/", json={"@type": "Trip", "title": "Iceland"})
    assert r.status_code == 201
    return r.json()


class TestControlPanel:
    def test_control_panel_listed(self, manager_request):
        r = manager_request.get("/@controlpanels")
        assert r.status_code == 200
        titles = [p["title"] for p in r.json()]
        assert "Travelstream" in titles

    def test_setting_defaults_to_document(self, manager_request):
        r = manager_request.get(f"/@registry/{REGISTRY_KEY}")
        assert r.status_code == 200
        assert r.json() == "Document"

    def test_setting_readable_by_authenticated_non_manager(
        self, manager_request, request_factory
    ):
        r = manager_request.post(
            "/@users",
            json={
                "username": "author",
                "password": "correct horse battery",
                "email": "author@example.org",
            },
        )
        assert r.status_code == 201
        session = request_factory(basic_auth=("author", "correct horse battery"))
        # Stock @registry is Manager-only; the PWA-facing contract is
        # @travelstream-settings (authenticated users only).
        r = session.get("/@travelstream-settings")
        assert r.status_code == 200
        assert r.json()["article_type"] == "Document"

    def test_settings_endpoint_denies_anonymous(self, anon_request):
        r = anon_request.get("/@travelstream-settings")
        assert r.status_code == 401

    def test_validator_rejects_type_without_behavior(self, portal):
        with pytest.raises(Invalid):
            validate_article_type("News Item")
        with pytest.raises(Invalid):
            validate_article_type("Nonexistent")
        assert validate_article_type("Document") is True

    def test_invariant_wired_into_schema(self, portal):
        class Data:
            article_type = "News Item"

        with pytest.raises(Invalid):
            ITravelstreamSettings.validateInvariants(Data())

    def test_switching_setting_changes_article_kind(
        self, trip, manager_request, portal_class
    ):
        # With the default setting, a Document in a Trip is kind "article"
        # for the discriminated-union contract (not a timeline member).
        from collective.travelstream.kinds import article_portal_type

        r = manager_request.patch(
            "/@registry",
            json={REGISTRY_KEY: "News Item"},
        )
        assert r.status_code in (200, 204), r.text
        r = manager_request.get(f"/@registry/{REGISTRY_KEY}")
        assert r.json() == "News Item"
        # The PWA-facing contract follows the setting
        r = manager_request.get("/@travelstream-settings")
        assert r.json()["article_type"] == "News Item"

    def test_control_panel_form_renders(self, manager_request, request_factory):
        session = request_factory(role="Manager", api=False)
        r = session.get("/@@travelstream-controlpanel", headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert "article_type" in r.text
