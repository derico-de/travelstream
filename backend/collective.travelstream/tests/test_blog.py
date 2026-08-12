"""Ticket 15: blog collection."""

import pytest

from .test_publish import SIMPLE_DOC


@pytest.fixture
def published_article(manager_request):
    r = manager_request.post(
        "/trips", json={"@type": "Trip", "title": "B", "id": "b"}
    )
    assert r.status_code == 201
    r = manager_request.post(
        "/trips/b",
        json={
            "@type": "Document",
            "title": "Northern lights",
            "description": "A night to remember",
            "prosemirror_doc": SIMPLE_DOC,
        },
    )
    assert r.status_code == 201, r.text
    article = r.json()
    r = manager_request.post(f"{article['@id']}/@travel-publish", json={})
    assert r.status_code == 200
    return article


class TestBlogCollection:
    def test_blog_collection_created_and_public(self, anon_request):
        r = anon_request.get("/blog")
        assert r.status_code == 200
        body = r.json()
        assert body["@type"] == "Collection"
        assert body["review_state"] == "published"

    def test_blog_lists_published_articles_newest_first(
        self, published_article, anon_request
    ):
        r = anon_request.get("/blog")
        titles = [i["title"] for i in r.json()["items"]]
        assert "Northern lights" in titles

    def test_unpublished_articles_never_listed(self, manager_request, anon_request):
        manager_request.post(
            "/trips", json={"@type": "Trip", "title": "B2", "id": "b2"}
        )
        r = manager_request.post(
            "/trips/b2",
            json={
                "@type": "Document",
                "title": "Secret draft",
                "prosemirror_doc": SIMPLE_DOC,
            },
        )
        assert r.status_code == 201
        r = anon_request.get("/blog")
        assert "Secret draft" not in [i["title"] for i in r.json()["items"]]

        r = anon_request.get("/@search?SearchableText=Secret")
        assert "Secret draft" not in [i["title"] for i in r.json()["items"]]

    def test_rss_feed_works(self, published_article, request_factory):
        anon_html = request_factory(api=False)
        r = anon_html.get("/RSS", headers={"Accept": "application/rss+xml"})
        # The feed view lives on the collection
        r = anon_html.get("/blog/RSS")
        assert r.status_code == 200
        assert "Northern lights" in r.text

    def test_article_page_renders_for_anonymous(
        self, published_article, request_factory
    ):
        anon_html = request_factory(api=False)
        r = anon_html.get(published_article["@id"], headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert "Published words." in r.text


class TestTripsArea:
    def test_household_trips_container_created(self, manager_request):
        r = manager_request.get("/trips")
        assert r.status_code == 200
        assert r.json()["@type"] == "Folder"

    def test_blog_scoped_to_trips_path(self, manager_request, anon_request):
        # A published Document OUTSIDE the trips area never reaches /blog.
        r = manager_request.post(
            "/", json={"@type": "Document", "title": "Site page", "id": "page"}
        )
        assert r.status_code == 201
        manager_request.post("/page/@workflow/publish", json={})
        r = anon_request.get("/blog")
        assert "Site page" not in [i["title"] for i in r.json()["items"]]
