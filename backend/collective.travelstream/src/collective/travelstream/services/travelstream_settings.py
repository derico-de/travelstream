"""@travelstream-settings REST API service.

Read-only settings contract for the PWA. The stock ``@registry`` endpoint
is Manager-only, so this exposes exactly the PWA-relevant settings to any
authenticated user — and nothing to anonymous.
"""

from collective.travelstream.kinds import article_portal_type
from plone import api
from plone.restapi.services import Service


class TravelstreamSettingsService(Service):
    """PWA-facing read-only Travelstream settings.

    Endpoint: @travelstream-settings
    """

    def reply(self):
        if api.user.is_anonymous():
            self.request.response.setStatus(401)
            return {
                "error": {
                    "type": "Unauthorized",
                    "message": "Authentication required",
                }
            }
        return {"article_type": article_portal_type()}
