"""Ticket 09: the ffmpeg worker's restapi interactions at the backend seam.

The worker container is plain requests + ffmpeg; everything it does over
the API is asserted here (polling query, blob download, poster + remux
writes, status transitions). ffmpeg invocation itself is trusted.
"""

import base64

import pytest

from .test_trip import png_bytes


def status_token(obj):
    value = obj.get("processing_status")
    if isinstance(value, dict):
        return value.get("token")
    return value


def video_payload(title, content_type="video/mp4"):
    return {
        "@type": "File",
        "title": title,
        "file": {
            "data": base64.b64encode(b"fake video bytes").decode("ascii"),
            "encoding": "base64",
            "filename": f"{title}.mp4",
            "content-type": content_type,
        },
    }


@pytest.fixture
def trip(manager_request):
    r = manager_request.post("/", json={"@type": "Trip", "title": "W", "id": "w"})
    assert r.status_code == 201
    return r.json()


class TestWorkerSeam:
    def test_video_upload_marked_processing(self, trip, manager_request):
        r = manager_request.post("/w", json=video_payload("clip"))
        assert r.status_code == 201, r.text
        obj = manager_request.get(r.json()["@id"]).json()
        assert status_token(obj) == "processing"

    def test_non_video_file_not_marked(self, trip, manager_request):
        payload = video_payload("doc", content_type="application/pdf")
        payload["file"]["filename"] = "doc.pdf"
        r = manager_request.post("/w", json=payload)
        obj = manager_request.get(r.json()["@id"]).json()
        assert status_token(obj) in (None, "")

    def test_video_outside_trip_not_marked(self, manager_request):
        r = manager_request.post("/", json=video_payload("rootclip"))
        obj = manager_request.get(r.json()["@id"]).json()
        assert status_token(obj) in (None, "")

    def test_worker_polling_query(self, trip, manager_request):
        manager_request.post("/w", json=video_payload("clip"))
        r = manager_request.get(
            "/@search?processing_status=processing&portal_type=File"
        )
        assert r.status_code == 200
        titles = [i["title"] for i in r.json()["items"]]
        assert "clip" in titles

    def test_worker_downloads_blob(self, trip, manager_request):
        created = manager_request.post("/w", json=video_payload("clip")).json()
        r = manager_request.get(f"{created['@id']}/@@download/file")
        assert r.status_code == 200
        assert r.content == b"fake video bytes"

    def test_worker_writes_poster_remux_and_status(self, trip, manager_request):
        created = manager_request.post("/w", json=video_payload("clip")).json()
        url = created["@id"]

        # What the worker PATCHes back after ffmpeg ran
        r = manager_request.patch(
            url,
            json={
                "image": {
                    "data": base64.b64encode(png_bytes()).decode("ascii"),
                    "encoding": "base64",
                    "filename": "poster.png",
                    "content-type": "image/png",
                },
                "file": {
                    "data": base64.b64encode(b"faststart remuxed").decode("ascii"),
                    "encoding": "base64",
                    "filename": "clip.mp4",
                    "content-type": "video/mp4",
                },
                "processing_status": "processed",
            },
        )
        assert r.status_code in (200, 204), r.text

        obj = manager_request.get(url).json()
        assert status_token(obj) == "processed"

        # Poster appears as the video's thumbnail on the timeline —
        # the same image-scale mechanism as photos.
        items = manager_request.get("/w/@travel-timeline?kind=video").json()["items"]
        scales = items[0]["image_scales"]
        assert "image" in scales

        # Off the polling query now
        r = manager_request.get(
            "/@search?processing_status=processing&portal_type=File"
        )
        assert "clip" not in [i["title"] for i in r.json()["items"]]

    def test_failure_is_visible_and_rerunnable(self, trip, manager_request):
        created = manager_request.post("/w", json=video_payload("corrupt")).json()
        url = created["@id"]

        r = manager_request.patch(
            url,
            json={
                "processing_status": "failed",
                "processing_error": "ffmpeg: moov atom not found",
            },
        )
        assert r.status_code in (200, 204)
        obj = manager_request.get(url).json()
        assert status_token(obj) == "failed"
        assert "moov atom" in obj["processing_error"]

        # Re-running = resetting to processing; polling picks it up again
        manager_request.patch(url, json={"processing_status": "processing"})
        r = manager_request.get(
            "/@search?processing_status=processing&portal_type=File"
        )
        assert "corrupt" in [i["title"] for i in r.json()["items"]]
