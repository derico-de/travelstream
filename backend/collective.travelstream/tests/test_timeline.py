"""Ticket 02: travel behaviors + @travel-timeline, via the REST HTTP seam."""

import pytest

from .test_trip import image_payload


def file_payload(title, **fields):
    return {
        "@type": "File",
        "title": title,
        "file": {
            "data": "dGVzdCB2aWRlbyBieXRlcw==",
            "encoding": "base64",
            "filename": "clip.mp4",
            "content-type": "video/mp4",
        },
        **fields,
    }


@pytest.fixture
def trips_area(manager_request):
    """Two trips with mixed captures in the household container
    (/trips is created by the installation profile)."""
    r = manager_request.post(
        "/trips", json={"@type": "Trip", "title": "Alps", "id": "alps"}
    )
    assert r.status_code == 201, r.text
    r = manager_request.post(
        "/trips", json={"@type": "Trip", "title": "Coast", "id": "coast"}
    )
    assert r.status_code == 201, r.text

    # Three photos in the Alps trip, captured out of creation order
    for name, captured in (
        ("first", "2026-07-03T08:00:00"),
        ("third", "2026-07-01T09:30:00"),
        ("second", "2026-07-02T12:00:00"),
    ):
        payload = image_payload(name)
        payload["captured_at"] = captured
        r = manager_request.post("/trips/alps", json=payload)
        assert r.status_code == 201, r.text

    # A video in the Alps trip
    r = manager_request.post(
        "/trips/alps",
        json=file_payload("clip", captured_at="2026-07-02T18:00:00"),
    )
    assert r.status_code == 201, r.text

    # A photo in the Coast trip with coordinates
    payload = image_payload("coastal")
    payload.update(
        captured_at="2026-07-10T10:00:00", latitude=64.1466, longitude=-21.9426
    )
    r = manager_request.post("/trips/coast", json=payload)
    assert r.status_code == 201, r.text

    return "/trips"


class TestTimelineService:
    def test_ordered_by_captured_at_descending(self, trips_area, manager_request):
        r = manager_request.get("/trips/alps/@travel-timeline")
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        titles = [i["title"] for i in items]
        assert titles == ["first", "clip", "second", "third"]

    def test_kind_derived_from_portal_type(self, trips_area, manager_request):
        items = manager_request.get("/trips/alps/@travel-timeline").json()["items"]
        kinds = {i["title"]: i["kind"] for i in items}
        assert kinds["first"] == "photo"
        assert kinds["clip"] == "video"

    def test_kind_filter(self, trips_area, manager_request):
        r = manager_request.get("/trips/alps/@travel-timeline?kind=video")
        items = r.json()["items"]
        assert [i["title"] for i in items] == ["clip"]

    def test_unknown_kind_is_bad_request(self, trips_area, manager_request):
        r = manager_request.get("/trips/alps/@travel-timeline?kind=sculpture")
        assert r.status_code == 400

    def test_date_range_filter(self, trips_area, manager_request):
        r = manager_request.get(
            "/trips/alps/@travel-timeline"
            "?captured_after=2026-07-02T00:00:00&captured_before=2026-07-02T23:59:59"
        )
        titles = [i["title"] for i in r.json()["items"]]
        assert titles == ["clip", "second"]

    def test_batching_contract(self, trips_area, manager_request):
        r = manager_request.get("/trips/alps/@travel-timeline?b_size=2")
        body = r.json()
        assert body["items_total"] == 4
        assert len(body["items"]) == 2
        assert "batching" in body
        assert "next" in body["batching"]

        r2 = manager_request.get(body["batching"]["next"])
        assert [i["title"] for i in r2.json()["items"]] == ["second", "third"]

    def test_membership_is_behavior_marker_not_type(
        self, trips_area, manager_request
    ):
        # A Document inside the trip has no ITravelCaptured behavior:
        # it must never appear on the timeline, regardless of type lists.
        r = manager_request.post(
            "/trips/alps", json={"@type": "Document", "title": "Draft article"}
        )
        assert r.status_code == 201, r.text
        items = manager_request.get("/trips/alps/@travel-timeline").json()["items"]
        assert "Draft article" not in [i["title"] for i in items]

    def test_items_carry_thumbnail_scales(self, trips_area, manager_request):
        items = manager_request.get(
            "/trips/alps/@travel-timeline?kind=photo"
        ).json()["items"]
        scales = items[0]["image_scales"]
        assert "image" in scales
        assert items[0]["UID"]
        download = scales["image"][0]["scales"]["thumb"]["download"]
        assert "@@images" in download

    def test_summary_carries_coordinates(self, trips_area, manager_request):
        items = manager_request.get("/trips/coast/@travel-timeline").json()["items"]
        assert items[0]["latitude"] == 64.1466
        assert items[0]["longitude"] == -21.9426

    def test_timeline_is_path_scoped(self, trips_area, manager_request):
        alps = manager_request.get("/trips/alps/@travel-timeline").json()
        assert "coastal" not in [i["title"] for i in alps["items"]]

    def test_timeline_on_household_container_spans_trips(
        self, trips_area, manager_request
    ):
        r = manager_request.get("/trips/@travel-timeline")
        assert r.status_code == 200
        titles = [i["title"] for i in r.json()["items"]]
        assert "coastal" in titles
        assert "first" in titles
        assert r.json()["items_total"] == 5

    def test_captured_at_fallback_is_creation_time(self, trips_area, manager_request):
        r = manager_request.post("/trips/alps", json=image_payload("no-metadata"))
        assert r.status_code == 201
        items = manager_request.get(
            "/trips/alps/@travel-timeline?kind=photo"
        ).json()["items"]
        by_title = {i["title"]: i for i in items}
        assert by_title["no-metadata"]["captured_at"] is not None
        # Created "now" (2026-08-10 or later), so it sorts newest
        assert items[0]["title"] == "no-metadata"

    def test_anonymous_gets_no_private_timeline(self, trips_area, anon_request):
        r = anon_request.get("/trips/alps/@travel-timeline")
        assert r.status_code in (401, 404)


class TestNoteType:
    """Ticket 03: Notes are first-class timeline citizens."""

    def test_note_addable_in_trip_with_body(self, trips_area, manager_request):
        r = manager_request.post(
            "/trips/alps",
            json={
                "@type": "Note",
                "title": "Thought",
                "text": "The pass was foggy all morning.",
                "captured_at": "2026-07-02T15:00:00",
                "latitude": 46.55,
                "longitude": 8.56,
            },
        )
        assert r.status_code == 201, r.text
        note = r.json()
        assert note["text"] == "The pass was foggy all morning."
        assert note["captured_at"].startswith("2026-07-02T15:00:00")

    def test_note_ordered_among_photos_and_videos(self, trips_area, manager_request):
        manager_request.post(
            "/trips/alps",
            json={
                "@type": "Note",
                "title": "Thought",
                "captured_at": "2026-07-02T15:00:00",
            },
        )
        items = manager_request.get("/trips/alps/@travel-timeline").json()["items"]
        titles = [i["title"] for i in items]
        assert titles == ["first", "clip", "Thought", "second", "third"]
        kinds = {i["title"]: i["kind"] for i in items}
        assert kinds["Thought"] == "note"

    def test_note_kind_filter(self, trips_area, manager_request):
        manager_request.post(
            "/trips/alps", json={"@type": "Note", "title": "Only note"}
        )
        items = manager_request.get(
            "/trips/alps/@travel-timeline?kind=note"
        ).json()["items"]
        assert [i["title"] for i in items] == ["Only note"]

    def test_note_captured_at_falls_back_to_creation(self, trips_area, manager_request):
        r = manager_request.post(
            "/trips/alps", json={"@type": "Note", "title": "No time"}
        )
        assert r.status_code == 201
        items = manager_request.get(
            "/trips/alps/@travel-timeline?kind=note"
        ).json()["items"]
        assert items[0]["captured_at"] is not None

    def test_note_not_addable_outside_allowed_containers(self, manager_request):
        r = manager_request.post(
            "/", json={"@type": "Note", "title": "Rootless note"}
        )
        assert r.status_code in (400, 403)
