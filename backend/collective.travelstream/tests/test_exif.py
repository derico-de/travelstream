"""Ticket 04: EXIF subscriber — assertions through the REST seam."""

import base64
from io import BytesIO

import pytest
from PIL import Image as PILImage


def jpeg_with_exif(
    datetime_original="2026:07:02 10:30:00",
    gps=((64.0, 8.0, 47.76), "N", (21.0, 56.0, 33.36), "W"),
):
    """A JPEG fixture photo with EXIF capture time and GPS position."""
    image = PILImage.new("RGB", (400, 300), (200, 160, 120))
    exif = PILImage.Exif()
    if datetime_original:
        exif[0x8769] = {0x9003: datetime_original}
    if gps:
        lat_dms, lat_ref, lon_dms, lon_ref = gps
        exif[0x8825] = {1: lat_ref, 2: lat_dms, 3: lon_ref, 4: lon_dms}
    buffer = BytesIO()
    image.save(buffer, "JPEG", exif=exif.tobytes())
    return buffer.getvalue()


def jpeg_payload(title, jpeg_bytes):
    return {
        "@type": "Image",
        "title": title,
        "image": {
            "data": base64.b64encode(jpeg_bytes).decode("ascii"),
            "encoding": "base64",
            "filename": f"{title}.jpg",
            "content-type": "image/jpeg",
        },
    }


@pytest.fixture
def trip(manager_request):
    r = manager_request.post("/", json={"@type": "Trip", "title": "Iceland"})
    assert r.status_code == 201
    return r.json()


class TestExifSubscriber:
    def test_exif_photo_is_stamped(self, trip, manager_request):
        r = manager_request.post(
            trip["@id"], json=jpeg_payload("geo-photo", jpeg_with_exif())
        )
        assert r.status_code == 201, r.text

        items = manager_request.get(
            f"{trip['@id']}/@travel-timeline"
        ).json()["items"]
        summary = {i["title"]: i for i in items}["geo-photo"]
        assert summary["captured_at"].startswith("2026-07-02T10:30:00")
        assert summary["latitude"] == pytest.approx(64.1466, abs=1e-4)
        assert summary["longitude"] == pytest.approx(-21.9426, abs=1e-4)

    def test_exif_position_orders_timeline(self, trip, manager_request):
        # EXIF capture time (2026-07-02) is older than upload time (today),
        # so a fresh no-EXIF photo must sort in front of the EXIF one.
        r = manager_request.post(
            trip["@id"], json=jpeg_payload("old-exif", jpeg_with_exif())
        )
        assert r.status_code == 201
        r = manager_request.post(
            trip["@id"],
            json=jpeg_payload("fresh", jpeg_with_exif(None, None)),
        )
        assert r.status_code == 201

        items = manager_request.get(
            f"{trip['@id']}/@travel-timeline"
        ).json()["items"]
        assert [i["title"] for i in items] == ["fresh", "old-exif"]

    def test_photo_without_exif_falls_back_to_upload_time(
        self, trip, manager_request
    ):
        r = manager_request.post(
            trip["@id"], json=jpeg_payload("plain", jpeg_with_exif(None, None))
        )
        assert r.status_code == 201, r.text
        items = manager_request.get(
            f"{trip['@id']}/@travel-timeline"
        ).json()["items"]
        summary = items[0]
        assert summary["captured_at"] is not None
        assert summary["captured_at"].startswith("2026-08")
        assert summary["latitude"] is None

    def test_image_outside_trip_is_not_stamped(self, manager_request):
        r = manager_request.post(
            "/", json=jpeg_payload("rootside", jpeg_with_exif())
        )
        assert r.status_code == 201, r.text
        obj = manager_request.get(r.json()["@id"]).json()
        assert obj["captured_at"] is None
        assert obj["latitude"] is None

    def test_replacing_image_reextracts_metadata(self, trip, manager_request):
        r = manager_request.post(
            trip["@id"], json=jpeg_payload("evolving", jpeg_with_exif())
        )
        assert r.status_code == 201
        url = r.json()["@id"]

        newer = jpeg_with_exif(
            "2026:07:15 20:00:00",
            ((48.0, 51.0, 29.6), "N", (2.0, 17.0, 40.2), "E"),
        )
        r = manager_request.patch(url, json=jpeg_payload("evolving", newer))
        assert r.status_code in (200, 204), r.text

        obj = manager_request.get(url).json()
        assert obj["captured_at"].startswith("2026-07-15T20:00:00")
        assert obj["latitude"] == pytest.approx(48.8582, abs=1e-4)
        assert obj["longitude"] == pytest.approx(2.2945, abs=1e-4)
