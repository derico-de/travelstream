"""@travel-publish REST API service.

Executes the publish (or retract) workflow transition on the article and
on every related entry it embeds (from the ITravelArticle relations), in
one request. Idempotent; reports per-object results. Drafts referencing
private media stay safe: publishing exposes exactly the embedded set.
"""

from plone import api
from plone.protect.interfaces import IDisableCSRFProtection
from plone.restapi.deserializer import json_body
from plone.restapi.services import Service
from Products.CMFCore.WorkflowCore import WorkflowException
from zope.interface import alsoProvides


TARGET_STATE = {"publish": "published", "retract": "private"}


class TravelPublishService(Service):
    """Publish an article and exactly the media it embeds.

    Endpoint: POST @travel-publish
    Body (optional): {"transition": "publish" | "retract",
                      "include_media": true | false}

    ``include_media`` defaults to true; pass false on retract to take
    only the article private (e.g. when its media is shared with another
    still-published article).
    """

    def reply(self):
        # Writing service: without this, plone.protect aborts the transaction.
        alsoProvides(self.request, IDisableCSRFProtection)
        data = json_body(self.request)
        transition = data.get("transition", "publish")
        if transition not in TARGET_STATE:
            self.request.response.setStatus(400)
            return {
                "error": {
                    "type": "BadRequest",
                    "message": "transition must be 'publish' or 'retract'",
                }
            }

        objects = [self.context]
        if data.get("include_media", True):
            for relation in getattr(self.context, "embedded_entries", None) or []:
                target = relation.to_object
                if target is not None:
                    objects.append(target)

        results = [self._transition_one(obj, transition) for obj in objects]
        ok = all(r["status"] in ("done", "unchanged") for r in results)
        return {
            "transition": transition,
            "all_done": ok,
            "items": results,
        }

    def _transition_one(self, obj, transition):
        target = TARGET_STATE[transition]
        result = {
            "@id": obj.absolute_url(),
            "uid": api.content.get_uuid(obj),
            "title": obj.Title(),
        }
        current = api.content.get_state(obj, default=None)
        if current == target:
            result.update(status="unchanged", review_state=current)
            return result
        try:
            api.content.transition(obj=obj, transition=transition)
        except (api.exc.InvalidParameterError, WorkflowException) as error:
            result.update(
                status="error",
                review_state=current,
                message=str(error),
            )
            return result
        result.update(
            status="done", review_state=api.content.get_state(obj, default=None)
        )
        return result
