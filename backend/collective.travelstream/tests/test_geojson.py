"""Ticket 08 (backend): @travel-geojson service."""

import pytest

from .test_trip import image_payload


@pytest.fixture
def geo_trip(manager_request):
    """A trip with geolocated and non-geolocated captures."""
    r = manager_request.post("/", json={"@type": "Trip", "title": "Geo", "id": "geo"})
    assert r.status_code == 201

    fixtures = [
        ("reykjavik", 64.1466, -21.9426, "2026-07-01T10:00:00"),
        ("vik", 63.4187, -19.0060, "2026-07-03T15:00:00"),
        ("hofn", 64.2539, -15.2082, "2026-07-05T09:00:00"),
    ]
    for title, lat, lon, captured in fixtures:
        payload = image_payload(title)
        payload.update(latitude=lat, longitude=lon, captured_at=captured)
        r = manager_request.post("/geo", json=payload)
        assert r.status_code == 201, r.text

    # A capture without coordinates — must be omitted from GeoJSON
    payload = image_payload("nowhere")
    payload["captured_at"] = "2026-07-02T11:00:00"
    r = manager_request.post("/geo", json=payload)
    assert r.status_code == 201

    # A note with coordinates
    r = manager_request.post(
        "/geo",
        json={
            "@type": "Note",
            "title": "Geyser note",
            "latitude": 64.3104,
            "longitude": -20.3024,
            "captured_at": "2026-07-02T12:00:00",
        },
    )
    assert r.status_code == 201, r.text
    return "/geo"


class TestGeojsonService:
    def test_valid_geojson_omits_uncoordinated(self, geo_trip, manager_request):
        r = manager_request.get(f"{geo_trip}/@travel-geojson")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["type"] == "FeatureCollection"
        titles = {f["properties"]["title"] for f in body["features"]}
        assert titles == {"reykjavik", "vik", "hofn", "Geyser note"}
        for feature in body["features"]:
            assert feature["type"] == "Feature"
            assert feature["geometry"]["type"] == "Point"
            lon, lat = feature["geometry"]["coordinates"]
            assert -180 <= lon <= 180
            assert -90 <= lat <= 90
            assert feature["properties"]["uid"]
            assert feature["properties"]["kind"] in ("photo", "note")
            assert feature["properties"]["captured_at"]

    def test_bbox_filter(self, geo_trip, manager_request):
        # Box around Reykjavik area only
        r = manager_request.get(
            f"{geo_trip}/@travel-geojson?bbox=-22.5,63.9,-21.5,64.3"
        )
        titles = {f["properties"]["title"] for f in r.json()["features"]}
        assert titles == {"reykjavik"}

    def test_bbox_composes_with_kind_and_dates(self, geo_trip, manager_request):
        # Box covering all of Iceland, but only notes
        r = manager_request.get(
            f"{geo_trip}/@travel-geojson?bbox=-25,63,-13,67&kind=note"
        )
        titles = {f["properties"]["title"] for f in r.json()["features"]}
        assert titles == {"Geyser note"}

        r = manager_request.get(
            f"{geo_trip}/@travel-geojson?bbox=-25,63,-13,67"
            "&captured_after=2026-07-03T00:00:00"
        )
        titles = {f["properties"]["title"] for f in r.json()["features"]}
        assert titles == {"vik", "hofn"}

    def test_invalid_bbox_is_bad_request(self, geo_trip, manager_request):
        r = manager_request.get(f"{geo_trip}/@travel-geojson?bbox=not,a,box")
        assert r.status_code == 400

    def test_photo_features_carry_thumbnail(self, geo_trip, manager_request):
        r = manager_request.get(f"{geo_trip}/@travel-geojson?kind=photo")
        for feature in r.json()["features"]:
            assert "@@images" in feature["properties"]["thumbnail"]

    def test_anonymous_gets_nothing_private(self, geo_trip, anon_request):
        r = anon_request.get(f"{geo_trip}/@travel-geojson")
        assert r.status_code in (401, 404)
