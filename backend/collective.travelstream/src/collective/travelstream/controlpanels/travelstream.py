"""Travelstream control panel.

The site owner chooses which content type is used for travel articles
(default: Page/Document). The PWA reads the setting over the standard
``@registry`` endpoint and creates articles of that type.
"""

from collective.travelstream import _
from plone.app.registry.browser.controlpanel import ControlPanelFormWrapper
from plone.app.registry.browser.controlpanel import RegistryEditForm
from plone.dexterity.interfaces import IDexterityFTI
from plone.restapi.controlpanels import RegistryConfigletPanel
from plone.supermodel import model
from zope import schema
from zope.component import adapter
from zope.component import queryUtility
from zope.interface import Interface
from zope.interface import Invalid
from zope.interface import invariant


ARTICLE_BEHAVIOR = "collective.travelstream.article"
REGISTRY_PREFIX = "collective.travelstream"


def validate_article_type(portal_type):
    """The chosen type must have the ITravelArticle behavior enabled."""
    fti = queryUtility(IDexterityFTI, name=portal_type)
    if fti is None:
        raise Invalid(
            _("'${type}' is not a Dexterity content type.", mapping={"type": portal_type})
        )
    if ARTICLE_BEHAVIOR not in (fti.behaviors or ()):
        raise Invalid(
            _(
                "The type '${type}' does not have the travel article behavior "
                "(collective.travelstream.article) enabled. Enable the behavior "
                "on the type first.",
                mapping={"type": portal_type},
            )
        )
    return True


class ITravelstreamSettings(model.Schema):
    """Registry-backed schema for the Travelstream control panel."""

    article_type = schema.Choice(
        title=_("Article content type"),
        description=_(
            "The content type used for travel articles. The type must have "
            "the travel article behavior enabled."
        ),
        vocabulary="plone.app.vocabularies.ReallyUserFriendlyTypes",
        required=True,
        default="Document",
    )

    @invariant
    def article_type_has_behavior(data):
        if data.article_type:
            validate_article_type(data.article_type)


class TravelstreamControlPanelForm(RegistryEditForm):
    """Edit form for the Travelstream control panel."""

    schema = ITravelstreamSettings
    schema_prefix = REGISTRY_PREFIX
    label = _("Travelstream")
    description = _("Travel content hub settings")


class TravelstreamControlPanelView(ControlPanelFormWrapper):
    """View wrapper exposing the form as a browser:page."""

    form = TravelstreamControlPanelForm


@adapter(Interface, Interface)
class TravelstreamControlPanelAdapter(RegistryConfigletPanel):
    """plone.restapi adapter exposing the Travelstream control panel."""

    schema = ITravelstreamSettings
    configlet_id = "travelstream-controlpanel"
    configlet_category_id = "Products"
    title = _("Travelstream")
    group = "Products"
    schema_prefix = REGISTRY_PREFIX
