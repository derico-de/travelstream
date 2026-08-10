"""Ticket 01: Trip type — all assertions through the plone.restapi HTTP seam."""

import base64

import pytest


PARTNER = {"username": "partner", "password": "correct horse battery"}

# 1x1 transparent PNG
PIXEL_PNG = base64.b64encode(
    base64.b16decode(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000D4944415478DA63FCCFC0F01F0005050101E9E94A340000000049454E44AE426082"
    )
).decode("ascii")


def image_payload(title="A photo"):
    return {
        "@type": "Image",
        "title": title,
        "image": {
            "data": PIXEL_PNG,
            "encoding": "base64",
            "filename": "pixel.png",
            "content-type": "image/png",
        },
    }


@pytest.fixture
def trip(manager_request):
    """A private Trip created via REST, as a manager."""
    response = manager_request.post(
        "/",
        json={
            "@type": "Trip",
            "title": "Iceland 2026",
            "description": "Ring road in summer",
            "start_date": "2026-07-01",
            "end_date": "2026-07-21",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestTripType:
    def test_trip_created_with_fields(self, trip):
        assert trip["@type"] == "Trip"
        assert trip["start_date"] == "2026-07-01"
        assert trip["end_date"] == "2026-07-21"
        assert trip["description"] == "Ring road in summer"

    def test_trip_is_folderish(self, trip):
        assert trip["is_folderish"] is True

    def test_trip_rejects_inverted_date_range(self, manager_request):
        response = manager_request.post(
            "/",
            json={
                "@type": "Trip",
                "title": "Backwards",
                "start_date": "2026-07-21",
                "end_date": "2026-07-01",
            },
        )
        assert response.status_code == 400

    def test_trip_private_on_creation(self, trip):
        assert trip["review_state"] == "private"

    def test_anonymous_cannot_read_private_trip(self, trip, anon_request):
        response = anon_request.get(trip["@id"])
        assert response.status_code in (401, 404)

    def test_trip_addable_types_constrained(self, trip, manager_request):
        response = manager_request.get(f"{trip['@id']}/@types")
        assert response.status_code == 200
        addable = {t["id"] for t in response.json() if t.get("addable")}
        assert {"Image", "File", "Document"} <= addable
        assert "News Item" not in addable
        assert "Folder" not in addable

    def test_disallowed_type_rejected_in_trip(self, trip, manager_request):
        response = manager_request.post(
            trip["@id"],
            json={"@type": "News Item", "title": "Not travel content"},
        )
        assert response.status_code in (400, 403)

    def test_stock_image_addable_in_trip(self, trip, manager_request):
        response = manager_request.post(trip["@id"], json=image_payload())
        assert response.status_code == 201, response.text


class TestTripSharing:
    """A partner with local roles on a Trip can add content there."""

    @pytest.fixture
    def partner(self, manager_request):
        response = manager_request.post(
            "/@users",
            json={
                "username": PARTNER["username"],
                "password": PARTNER["password"],
                "email": "partner@example.org",
            },
        )
        assert response.status_code == 201, response.text
        return PARTNER

    def test_partner_cannot_see_unshared_trip(self, trip, partner, request_factory):
        session = request_factory(
            basic_auth=(partner["username"], partner["password"])
        )
        response = session.get(trip["@id"])
        assert response.status_code in (401, 403, 404)

    def test_partner_with_local_roles_can_add_content(
        self, trip, partner, manager_request, request_factory
    ):
        response = manager_request.post(
            f"{trip['@id']}/@sharing",
            json={
                "entries": [
                    {
                        "id": partner["username"],
                        "roles": {"Contributor": True, "Editor": True, "Reader": True},
                        "type": "user",
                    }
                ]
            },
        )
        assert response.status_code == 204, response.text

        session = request_factory(
            basic_auth=(partner["username"], partner["password"])
        )
        response = session.post(trip["@id"], json=image_payload("Partner photo"))
        assert response.status_code == 201, response.text
        created = response.json()
        assert created["parent"]["@id"] == trip["@id"]


class TestJWTLogin:
    """Stock plone.restapi JWT auth works against the site (PWA contract)."""

    def test_login_returns_token(self, request_factory, site_owner_name,
                                 site_owner_password):
        session = request_factory()
        response = session.post(
            "/@login",
            json={"login": site_owner_name, "password": site_owner_password},
        )
        assert response.status_code == 200
        token = response.json()["token"]

        session.headers.update({"Authorization": f"Bearer {token}"})
        response = session.get("/")
        assert response.status_code == 200
