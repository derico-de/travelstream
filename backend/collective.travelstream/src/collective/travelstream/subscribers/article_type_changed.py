"""Keep dependent configuration in step with the article-type setting.

When the site owner switches ``collective.travelstream.article_type`` in
the control panel, the Trip FTI's addable types and the blog collection's
criteria must follow — the spec's contract is "the REST contract and
article creation follow the setting".
"""

import logging

from collective.travelstream.subscribers import addon_installed
from plone.dexterity.interfaces import IDexterityFTI
from zope.component import queryUtility
from zope.component.hooks import getSite


logger = logging.getLogger("collective.travelstream")

RECORD_NAME = "collective.travelstream.article_type"


def handler(event):
    """Handle IRecordModifiedEvent for the article-type registry record."""
    if getattr(event.record, "__name__", None) != RECORD_NAME:
        return
    if not addon_installed():
        return
    old, new = event.oldValue, event.newValue
    if not new or old == new:
        return

    fti = queryUtility(IDexterityFTI, name="Trip")
    if fti is not None:
        allowed = [t for t in (fti.allowed_content_types or ()) if t != old]
        if new not in allowed:
            allowed.append(new)
        fti.allowed_content_types = tuple(allowed)

    site = getSite()
    blog = site.get("blog") if site is not None else None
    if blog is not None and getattr(blog, "query", None):
        query = []
        for row in blog.query:
            if row.get("i") == "portal_type":
                row = dict(row, v=[new])
            query.append(row)
        blog.query = query

    logger.info("article type switched %r -> %r; Trip addables + blog updated", old, new)
