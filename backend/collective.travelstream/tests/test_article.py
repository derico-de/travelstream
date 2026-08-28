"""Ticket 10: article behavior + server-side renderer + search.

The renderer is exercised through the REST/HTTP seam (create via REST, GET
the rendered view) plus the shared golden fixtures that pin renderer output
for parity with TipTap's generateHTML (frontend suite).
"""

import json
from pathlib import Path

import pytest

from collective.travelstream.renderer import render_document


FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "shared" / "prosemirror-fixtures"

SIMPLE_DOC = {
    "type": "doc",
    "content": [
        {
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": "Glacier day"}],
        },
        {
            "type": "paragraph",
            "content": [
                {"type": "text", "text": "We walked on "},
                {"type": "text", "text": "Svinafellsjokull", "marks": [{"type": "bold"}]},
                {"type": "text", "text": " for hours."},
            ],
        },
    ],
}


@pytest.fixture
def trip(manager_request):
    r = manager_request.post("/", json={"@type": "Trip", "title": "Iceland"})
    assert r.status_code == 201
    return r.json()


def create_article(manager_request, trip, doc, title="Glacier day"):
    r = manager_request.post(
        trip["@id"],
        json={"@type": "Document", "title": title, "prosemirror_doc": doc},
    )
    assert r.status_code == 201, r.text
    return r.json()


class TestGoldenFixtures:
    """The Python renderer is pinned by the shared golden fixtures."""

    @pytest.mark.parametrize(
        "name",
        [
            "basic",
            "lists-quote",
            "media",
            "gallery",
            "gallery-empty",
            "unknown-node",
            "media-text-left",
            "media-text-right",
            "media-text-top",
            "media-text-no-uid",
        ],
    )
    def test_fixture(self, name):
        doc = json.loads((FIXTURES_DIR / f"{name}.json").read_text())
        expected = (FIXTURES_DIR / f"{name}.html").read_text().strip()
        assert render_document(doc) == expected

    def test_media_text_uid_extracted(self):
        from collective.travelstream.renderer import extract_media_uids

        doc = json.loads((FIXTURES_DIR / "media-text-left.json").read_text())
        assert extract_media_uids(doc) == ["0123456789abcdef0123456789abcdef"]

    def test_media_text_caption_and_body_searchable(self):
        from collective.travelstream.renderer import extract_text

        doc = json.loads((FIXTURES_DIR / "media-text-left.json").read_text())
        text = extract_text(doc)
        assert "Husavik harbour" in text
        assert "Whale watching" in text


class TestArticleRendering:
    def test_view_returns_server_rendered_html(
        self, trip, manager_request, request_factory
    ):
        article = create_article(manager_request, trip, SIMPLE_DOC)
        html_session = request_factory(role="Manager", api=False)
        r = html_session.get(article["@id"], headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert "<h2>Glacier day</h2>" in r.text
        assert "<strong>Svinafellsjokull</strong>" in r.text
        assert "travel-article-body" in r.text

    def test_resolveuid_figure_and_video_render(
        self, trip, manager_request, request_factory
    ):
        doc = json.loads((FIXTURES_DIR / "media.json").read_text())
        article = create_article(manager_request, trip, doc, "Media day")
        html_session = request_factory(role="Manager", api=False)
        r = html_session.get(article["@id"], headers={"Accept": "text/html"})
        assert r.status_code == 200
        # PictureVariantsFilter expands data-picturevariant="large" into a
        # <picture> tag whose srcset/base come from plone.picture_variants
        # (variant "large" renders from the "larger" scale).
        assert "<picture>" in r.text
        assert (
            'src="resolveuid/0123456789abcdef0123456789abcdef/@@images/image/larger"'
            in r.text
        )
        assert (
            "resolveuid/0123456789abcdef0123456789abcdef/@@images/image/huge 1600w"
            in r.text
        )
        assert "<video controls" in r.text
        assert "@@display-media/file" in r.text

    def test_unknown_node_renders_fallback_not_error(
        self, trip, manager_request, request_factory
    ):
        doc = json.loads((FIXTURES_DIR / "unknown-node.json").read_text())
        article = create_article(manager_request, trip, doc, "Strange day")
        html_session = request_factory(role="Manager", api=False)
        r = html_session.get(article["@id"], headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert 'data-node-type="galacticChart"' in r.text
        assert "trapped text" in r.text

    def test_json_roundtrips_losslessly(self, trip, manager_request):
        article = create_article(manager_request, trip, SIMPLE_DOC)
        fetched = manager_request.get(article["@id"]).json()
        assert fetched["prosemirror_doc"] == SIMPLE_DOC

    def test_no_html_copy_stored(self, trip, manager_request):
        article = create_article(manager_request, trip, SIMPLE_DOC)
        fetched = manager_request.get(article["@id"]).json()
        # Document's own RichText field stays empty — the JSON is the only
        # representation.
        assert fetched.get("text") in (None, ""), fetched.get("text")


class TestDisplayMedia:
    def test_video_served_inline(self, trip, manager_request):
        # @@display-media must send Content-Disposition: inline — Firefox
        # shows no playback UI for attachment-flagged <video> sources.
        from .test_worker_seam import video_payload

        created = manager_request.post(trip["@id"], json=video_payload("clip")).json()
        r = manager_request.get(f"{created['@id']}/@@display-media/file")
        assert r.status_code == 200
        assert r.headers["Content-Disposition"].startswith("inline")
        assert r.content == b"fake video bytes"


class TestArticleSearch:
    def test_search_finds_article_body_text(self, trip, manager_request):
        create_article(manager_request, trip, SIMPLE_DOC)
        r = manager_request.get("/@search?SearchableText=Svinafellsjokull")
        assert r.status_code == 200
        titles = [i["title"] for i in r.json()["items"]]
        assert "Glacier day" in titles

    def test_search_does_not_find_absent_text(self, trip, manager_request):
        create_article(manager_request, trip, SIMPLE_DOC)
        r = manager_request.get("/@search?SearchableText=Jokulsarlon")
        titles = [i["title"] for i in r.json()["items"]]
        assert "Glacier day" not in titles


class TestClassicUIForms:
    def test_richtext_and_json_fields_absent_from_edit_form(
        self, trip, manager_request, request_factory
    ):
        article = create_article(manager_request, trip, SIMPLE_DOC)
        html_session = request_factory(role="Manager", api=False)
        r = html_session.get(article["@id"] + "/edit", headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert "IRichTextBehavior.text" not in r.text
        assert "prosemirror_doc" not in r.text
        assert "embedded_entries" not in r.text
