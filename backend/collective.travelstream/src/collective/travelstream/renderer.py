"""Deterministic server-side ProseMirror JSON -> HTML renderer.

Covers exactly the constrained TipTap node set shared with the PWA editor
(paragraphs, headings, lists, blockquote, code block, links, marks,
resolveuid image figures with scale URLs, video embeds). Unknown nodes
render as a safe fallback — never an error. All text and attribute values
are escaped; output is deterministic so it can be pinned by the golden
fixtures shared with TipTap's generateHTML (see shared/prosemirror-fixtures).

``resolveuid/...`` URLs are emitted as-is: they survive moves and renames
and Plone resolves them at browse time.
"""

import html


IMAGE_SCALES = {"thumb", "mini", "preview", "teaser", "large", "larger", "great", "huge"}
DEFAULT_IMAGE_SCALE = "large"
POSTER_SCALE = "large"

_MARK_TAGS = {
    "bold": "strong",
    "strong": "strong",
    "italic": "em",
    "em": "em",
    "underline": "u",
    "strike": "s",
    "code": "code",
}


def _esc(value):
    return html.escape(str(value), quote=True)


def _apply_marks(text_html, marks):
    for mark in reversed(marks or []):
        mark_type = mark.get("type")
        if mark_type == "link":
            attrs = mark.get("attrs") or {}
            href = _esc(attrs.get("href") or "")
            rel = ""
            if href.startswith(("http://", "https://")):
                rel = ' rel="noopener noreferrer"'
            text_html = f'<a href="{href}"{rel}>{text_html}</a>'
        elif mark_type in _MARK_TAGS:
            tag = _MARK_TAGS[mark_type]
            text_html = f"<{tag}>{text_html}</{tag}>"
        # Unknown marks are dropped silently: the text stays, unstyled.
    return text_html


def _children(node):
    return "".join(_node(child) for child in node.get("content") or [])


def _heading(node):
    attrs = node.get("attrs") or {}
    level = attrs.get("level")
    if not isinstance(level, int) or not 1 <= level <= 6:
        level = 2
    return f"<h{level}>{_children(node)}</h{level}>"


def _ordered_list(node):
    attrs = node.get("attrs") or {}
    start = attrs.get("start")
    start_attr = ""
    if isinstance(start, int) and start != 1:
        start_attr = f' start="{start}"'
    return f"<ol{start_attr}>{_children(node)}</ol>"


def _travel_image(node):
    attrs = node.get("attrs") or {}
    uid = _esc(attrs.get("uid") or "")
    if not uid:
        return _unknown(node)
    scale = attrs.get("scale")
    if scale not in IMAGE_SCALES:
        scale = DEFAULT_IMAGE_SCALE
    alt = _esc(attrs.get("alt") or "")
    src = f"resolveuid/{uid}/@@images/image/{scale}"
    caption = attrs.get("caption")
    caption_html = f"<figcaption>{_esc(caption)}</figcaption>" if caption else ""
    return (
        f'<figure class="travel-image">'
        f'<img src="{src}" alt="{alt}" loading="lazy">'
        f"{caption_html}</figure>"
    )


def _travel_video(node):
    attrs = node.get("attrs") or {}
    uid = _esc(attrs.get("uid") or "")
    if not uid:
        return _unknown(node)
    src = f"resolveuid/{uid}/@@download/file"
    poster = f"resolveuid/{uid}/@@images/image/{POSTER_SCALE}"
    caption = attrs.get("caption")
    caption_html = f"<figcaption>{_esc(caption)}</figcaption>" if caption else ""
    return (
        f'<figure class="travel-video">'
        f'<video controls preload="metadata" src="{src}" poster="{poster}"></video>'
        f"{caption_html}</figure>"
    )


def _unknown(node):
    node_type = _esc(node.get("type") or "")
    return (
        f'<div class="travel-unknown" data-node-type="{node_type}">'
        f"{_children(node)}</div>"
    )


_RENDERERS = {
    "paragraph": lambda node: f"<p>{_children(node)}</p>",
    "heading": _heading,
    "bulletList": lambda node: f"<ul>{_children(node)}</ul>",
    "orderedList": _ordered_list,
    "listItem": lambda node: f"<li>{_children(node)}</li>",
    "blockquote": lambda node: f"<blockquote>{_children(node)}</blockquote>",
    "codeBlock": lambda node: f"<pre><code>{_children(node)}</code></pre>",
    "hardBreak": lambda node: "<br>",
    "horizontalRule": lambda node: "<hr>",
    "travelImage": _travel_image,
    "travelVideo": _travel_video,
}


def _node(node):
    if not isinstance(node, dict):
        return ""
    node_type = node.get("type")
    if node_type == "text":
        return _apply_marks(_esc(node.get("text") or ""), node.get("marks"))
    renderer = _RENDERERS.get(node_type)
    if renderer is None:
        return _unknown(node)
    return renderer(node)


def render_document(doc):
    """Render a ProseMirror document (dict) to an HTML string."""
    if not isinstance(doc, dict):
        return ""
    if doc.get("type") == "doc":
        return _children(doc)
    return _node(doc)


def extract_text(doc):
    """Plain text of every text node, for SearchableText indexing."""
    parts = []

    def walk(node):
        if not isinstance(node, dict):
            return
        text = node.get("text")
        if text:
            parts.append(str(text))
        caption = (node.get("attrs") or {}).get("caption")
        if caption:
            parts.append(str(caption))
        for child in node.get("content") or []:
            walk(child)

    walk(doc)
    return " ".join(parts)
