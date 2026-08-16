"""Form extenders for travel articles.

While ITravelArticle is enabled on a type that carries its own RichText
field (Document's ``text``), that field is omitted from Classic UI forms:
it stays empty and plays no role — the ProseMirror JSON is the only
representation.
"""

from collective.travelstream.behaviors.itravelarticle import ITravelArticle
from collective.travelstream.interfaces import ICollectiveTravelstreamLayer
from plone.dexterity.browser.add import DefaultAddForm
from plone.dexterity.browser.edit import DefaultEditForm
from plone.dexterity.interfaces import IDexterityFTI
from plone.z3cform.fieldsets.extensible import FormExtender
from zope.component import adapter
from zope.component import queryUtility
from zope.interface import Interface


ARTICLE_BEHAVIOR = "collective.travelstream.article"
RICHTEXT_PREFIX = "IRichTextBehavior"


class OmitRichTextBase(FormExtender):
    def _remove_richtext(self):
        try:
            self.remove("text", prefix=RICHTEXT_PREFIX)
        except KeyError:
            pass


@adapter(ITravelArticle, ICollectiveTravelstreamLayer, DefaultEditForm)
class OmitRichTextOnEdit(OmitRichTextBase):
    """Drop the stock RichText field from the edit form of articles."""

    def update(self):
        self._remove_richtext()


@adapter(Interface, ICollectiveTravelstreamLayer, DefaultAddForm)
class OmitRichTextOnAdd(OmitRichTextBase):
    """Drop the stock RichText field when adding the article type.

    Bound to the add-on layer: the context discriminator is ``Interface``,
    so without it this would run on every Dexterity add form of every site
    in the instance.
    """

    def update(self):
        fti = queryUtility(IDexterityFTI, name=self.form.portal_type)
        if fti is not None and ARTICLE_BEHAVIOR in (fti.behaviors or ()):
            self._remove_richtext()
