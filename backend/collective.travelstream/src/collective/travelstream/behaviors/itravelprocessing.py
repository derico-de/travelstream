"""ITravelProcessing behavior.

Worker contract: the EXIF-style subscriber marks video Files inside a
Trip as ``processing``; the ffmpeg worker polls the catalog over
plone.restapi, does its work and writes ``processed`` or ``failed``
(with the reason in ``processing_error``). Failures stay visible and
re-runnable by resetting the status to ``processing``.
"""

from collective.travelstream import _
from plone.autoform import directives
from plone.autoform.interfaces import IFormFieldProvider
from plone.supermodel import model
from zope import schema
from zope.interface import provider


PROCESSING_STATES = ["", "processing", "processed", "failed"]


@provider(IFormFieldProvider)
class ITravelProcessing(model.Schema):
    """Media processing status of a travel video."""

    directives.omitted("processing_status")
    processing_status = schema.Choice(
        title=_("Processing status"),
        values=PROCESSING_STATES,
        required=False,
        default="",
    )

    directives.omitted("processing_error")
    processing_error = schema.Text(
        title=_("Processing error"),
        description=_("Why the last processing run failed"),
        required=False,
    )
