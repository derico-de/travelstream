"""ITravelArticle behavior.

The canonical ProseMirror JSON is the article's ONLY stored representation
— no HTML copy, no rendition field. Relations to embedded entries are
maintained by the editor on save and consumed by the publish action.

Both fields are omitted from Classic UI forms (plone.autoform ``omitted``)
so raw JSON cannot be corrupted by hand; plone.restapi ignores form
directives, so the PWA reads and writes them freely. The Classic UI
editing surface (TipTap widget, ticket 19) is deliberately deferred.
"""

from collective.travelstream import _
from plone.autoform import directives
from plone.autoform.interfaces import IFormFieldProvider
from plone.schema import JSONField
from plone.supermodel import model
from z3c.relationfield.schema import RelationChoice
from z3c.relationfield.schema import RelationList
from zope.interface import provider


@provider(IFormFieldProvider)
class ITravelArticle(model.Schema):
    """Canonical ProseMirror JSON document + relations to embedded entries."""

    directives.omitted("prosemirror_doc")
    prosemirror_doc = JSONField(
        title=_("Article document"),
        description=_("The canonical ProseMirror JSON document"),
        required=False,
    )

    directives.omitted("embedded_entries")
    embedded_entries = RelationList(
        title=_("Embedded entries"),
        description=_(
            "The travel entries embedded in the article; maintained by the "
            "editor on save, consumed by the publish action"
        ),
        value_type=RelationChoice(
            title=_("Embedded entry"),
            vocabulary="plone.app.vocabularies.Catalog",
        ),
        required=False,
        default=[],
    )
