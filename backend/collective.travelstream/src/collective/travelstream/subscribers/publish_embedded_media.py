"""Keep the invariant: a published article's embedded media is published.

Two paths uphold it:

- workflow: publishing the article — through @travel-publish, the Classic
  UI workflow menu, or any other transition path — publishes its media;
- editing: saving an already-published article publishes media that was
  embedded after the article went public.

Retract is never mirrored automatically: media may be shared with another
still-published article. @travel-publish retracts media explicitly.
"""

from plone import api

from collective.travelstream.publishing import publish_embedded_media
from collective.travelstream.subscribers import addon_installed


def article_transitioned(obj, event):
    if not addon_installed():
        return
    if getattr(event.new_state, "id", None) != "published":
        return
    publish_embedded_media(obj)


def article_modified(obj, event):
    if not addon_installed():
        return
    if api.content.get_state(obj, default=None) != "published":
        return
    publish_embedded_media(obj)
