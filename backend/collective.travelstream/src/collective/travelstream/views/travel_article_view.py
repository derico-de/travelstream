"""travel-article-view browser view.

Renders the article's canonical ProseMirror JSON to HTML server-side at
view time — the published page always shows exactly the canonical
document. Output is cached per modification time.
"""

from collective.travelstream.renderer import render_document
from plone.memoize import ram
from Products.Five.browser import BrowserView


def _body_cachekey(fun, self):
    return (self.context.UID(), self.context.modified().ISO8601())


class TravelArticleView(BrowserView):
    """Server-side rendering of the canonical ProseMirror JSON."""

    @ram.cache(_body_cachekey)
    def body_html(self):
        return render_document(getattr(self.context, "prosemirror_doc", None))
