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
        return {
            "article_type": article_portal_type(),
            "can_add_keywords": self._can_add_keywords(),
        }

    def _can_add_keywords(self):
        """May the current user create new keywords (tags)?

        Same rule as Plone's Classic UI keywords widget: the user needs
        one of the roles in ``plone.roles_allowed_to_add_keywords``.
        """
        allowed_roles = api.portal.get_registry_record(
            "plone.roles_allowed_to_add_keywords", default=[]
        )
        user = api.user.get_current()
        roles = set(user.getRolesInContext(self.context))
        return bool(roles.intersection(allowed_roles))
