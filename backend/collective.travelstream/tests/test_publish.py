"""Ticket 14 (backend): travel workflow + @travel-publish."""

import pytest

from .test_trip import image_payload


SIMPLE_DOC = {
    "type": "doc",
    "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "Published words."}]},
    ],
}


@pytest.fixture
def publish_setup(manager_request):
    """Trip with two images and an article embedding exactly one of them."""
    r = manager_request.post("/", json={"@type": "Trip", "title": "Pub", "id": "pub"})
    assert r.status_code == 201
    trip = r.json()

    embedded = manager_request.post("/pub", json=image_payload("embedded")).json()
    private = manager_request.post("/pub", json=image_payload("private")).json()

    r = manager_request.post(
        "/pub",
        json={
            "@type": "Document",
            "title": "The article",
            "prosemirror_doc": SIMPLE_DOC,
            "embedded_entries": [embedded["UID"]],
        },
    )
    assert r.status_code == 201, r.text
    article = r.json()
    return {
        "trip": trip,
        "embedded": embedded,
        "private": private,
        "article": article,
    }


class TestTravelWorkflow:
    def test_travel_content_private_on_creation(self, publish_setup):
        assert publish_setup["trip"]["review_state"] == "private"
        assert publish_setup["embedded"]["review_state"] == "private"

    def test_workflow_bound_to_stock_image_and_file(self, portal):
        wf = portal.portal_workflow
        for portal_type in ("Image", "File", "Note", "Trip"):
            assert wf.getChainForPortalType(portal_type) == (
                "travelstream_workflow",
            ), portal_type

    def test_document_keeps_its_stock_workflow(self, portal):
        wf = portal.portal_workflow
        assert "travelstream_workflow" not in wf.getChainForPortalType("Document")


class TestTravelPublish:
    def test_publish_exposes_article_and_exactly_its_media(
        self, publish_setup, manager_request, anon_request, request_factory
    ):
        article = publish_setup["article"]
        r = manager_request.post(f"{article['@id']}/@travel-publish", json={})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["all_done"] is True
        statuses = {i["title"]: i["status"] for i in body["items"]}
        assert statuses == {"The article": "done", "embedded": "done"}

        # Anonymous reads the published article view with embedded media
        anon_html = request_factory(api=False)
        r = anon_html.get(article["@id"], headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert "Published words." in r.text

        r = anon_request.get(publish_setup["embedded"]["@id"])
        assert r.status_code == 200

        # The trip and the non-embedded image stay private
        r = anon_request.get(publish_setup["trip"]["@id"])
        assert r.status_code in (401, 404)
        r = anon_request.get(publish_setup["private"]["@id"])
        assert r.status_code in (401, 404)

    def test_publish_is_idempotent(self, publish_setup, manager_request):
        url = f"{publish_setup['article']['@id']}/@travel-publish"
        r = manager_request.post(url, json={})
        assert r.status_code == 200
        r = manager_request.post(url, json={})
        assert r.status_code == 200
        statuses = {i["status"] for i in r.json()["items"]}
        assert statuses == {"unchanged"}

    def test_retract_reverses_publication(
        self, publish_setup, manager_request, anon_request
    ):
        article = publish_setup["article"]
        manager_request.post(f"{article['@id']}/@travel-publish", json={})
        r = manager_request.post(
            f"{article['@id']}/@travel-publish", json={"transition": "retract"}
        )
        assert r.status_code == 200, r.text
        assert r.json()["all_done"] is True

        r = anon_request.get(article["@id"])
        assert r.status_code in (401, 404)
        r = anon_request.get(publish_setup["embedded"]["@id"])
        assert r.status_code in (401, 404)

    def test_unknown_transition_is_bad_request(self, publish_setup, manager_request):
        r = manager_request.post(
            f"{publish_setup['article']['@id']}/@travel-publish",
            json={"transition": "vanish"},
        )
        assert r.status_code == 400

    def test_versioning_history_present(self, publish_setup, manager_request):
        article = publish_setup["article"]
        manager_request.post(f"{article['@id']}/@travel-publish", json={})
        manager_request.post(
            f"{article['@id']}/@travel-publish", json={"transition": "retract"}
        )
        r = manager_request.get(f"{article['@id']}/@history")
        assert r.status_code == 200
        actions = [e.get("action") for e in r.json()]
        assert "publish" in actions
        assert "retract" in actions


class TestEmbeddedRelations:
    """Ticket 13: the editor maintains embedded_entries via PATCH (UIDs)."""

    def test_relations_updated_to_exact_set(self, publish_setup, manager_request):
        article = publish_setup["article"]
        other = publish_setup["private"]

        # Swap the embedded set: remove 'embedded', add 'private'
        r = manager_request.patch(
            article["@id"], json={"embedded_entries": [other["UID"]]}
        )
        assert r.status_code in (200, 204), r.text

        fetched = manager_request.get(article["@id"]).json()
        uids = [rel["UID"] for rel in fetched["embedded_entries"]]
        assert uids == [other["UID"]]

        # Publish now exposes exactly the new set
        r = manager_request.post(f"{article['@id']}/@travel-publish", json={})
        titles = {i["title"] for i in r.json()["items"]}
        assert titles == {"The article", "private"}

    def test_embed_survives_rename(self, publish_setup, manager_request):
        # resolveuid embeds keep working when the source entry is renamed:
        # the rendered HTML references the UID, not the path.
        embedded = publish_setup["embedded"]
        r = manager_request.patch(embedded["@id"], json={"title": "renamed"})
        assert r.status_code in (200, 204)
        fetched = manager_request.get(publish_setup["article"]["@id"]).json()
        assert fetched["embedded_entries"][0]["UID"] == embedded["UID"]
