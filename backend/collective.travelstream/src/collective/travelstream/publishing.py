"""Publishing helpers: an article's embedded media follows the article.

The canonical ProseMirror document is the source of truth for what an
article embeds; the ``embedded_entries`` relation list (maintained by the
PWA on save) is merged in defensively for documents whose relations and
JSON have drifted apart.
"""

import logging

from plone import api
from plone.app.uuid.utils import uuidToObject
from Products.CMFCore.WorkflowCore import WorkflowException

from collective.travelstream.renderer import extract_media_uids


logger = logging.getLogger(__name__)


def embedded_media_objects(article):
    """Every object the article embeds, doc order, relations appended.

    Resolution is unrestricted on purpose: the media of a draft is
    private, so a restricted lookup could silently miss exactly the
    objects publishing must expose. Workflow guards still apply to any
    transition performed on the result.
    """
    objects = []
    seen = set()

    def add(uid, obj):
        if obj is None or uid in seen:
            return
        seen.add(uid)
        objects.append(obj)

    for uid in extract_media_uids(getattr(article, "prosemirror_doc", None)):
        add(uid, uuidToObject(uid, unrestricted=True))
    for relation in getattr(article, "embedded_entries", None) or []:
        target = relation.to_object
        if target is not None:
            add(api.content.get_uuid(target), target)
    return objects


def publish_embedded_media(article):
    """Bring every embedded media object to published (idempotent).

    Failures are logged, never raised: the article's own transition must
    not fail because one media object cannot follow.
    """
    for obj in embedded_media_objects(article):
        if api.content.get_state(obj, default=None) == "published":
            continue
        try:
            api.content.transition(obj=obj, transition="publish")
        except (api.exc.InvalidParameterError, WorkflowException) as error:
            logger.warning(
                "Embedded media %s could not be published: %s",
                obj.absolute_url(),
                error,
            )
