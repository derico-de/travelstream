"""Trip content type."""
from collective.travelstream import _
from plone.dexterity.content import Container
from plone.supermodel import model
from zope import schema
from zope.interface import implementer
from zope.interface import Invalid
from zope.interface import invariant


class ITrip(model.Schema):
    """Schema for Trip content type.

    A folderish travel trip: date range, cover image (via plone.leadimage),
    description (via plone.dublincore).
    """

    start_date = schema.Date(
        title=_("Start date"),
        description=_("First day of the trip"),
        required=False,
    )

    end_date = schema.Date(
        title=_("End date"),
        description=_("Last day of the trip"),
        required=False,
    )

    @invariant
    def validate_date_range(data):
        if data.start_date and data.end_date and data.start_date > data.end_date:
            raise Invalid(_("The trip start date must be before its end date."))


@implementer(ITrip)
class Trip(Container):
    """Trip content class."""
