"""Note content type."""
from collective.travelstream import _
from plone.dexterity.content import Item
from plone.supermodel import model
from zope import schema
from zope.interface import implementer


class INote(model.Schema):
    """Schema for Note content type.

    A quick text note captured on the road: title + plain text body.
    Capture time and geolocation come from the travel behaviors.
    """

    text = schema.Text(
        title=_("Text"),
        description=_("The note body"),
        required=False,
    )


@implementer(INote)
class Note(Item):
    """Note content class."""
