"""SearchableText catalog indexer for travel articles.

Extracts plain text from the canonical ProseMirror JSON — indexing, not a
stored copy. No dummy guard here: SearchableText exists site-wide and this
indexer must only *specialize* it for ITravelArticle objects.
"""

from collective.travelstream.behaviors.itravelarticle import ITravelArticle
from collective.travelstream.renderer import extract_text
from plone.indexer import indexer


@indexer(ITravelArticle)
def SearchableText(obj):
    """Title, description and the article body text from the JSON."""
    parts = [
        obj.Title() or "",
        obj.Description() or "",
        extract_text(getattr(obj, "prosemirror_doc", None) or {}),
    ]
    return " ".join(part for part in parts if part)
