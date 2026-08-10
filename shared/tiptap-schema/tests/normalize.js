/**
 * Normalize HTML for parity comparison between the Python renderer and
 * TipTap's generateHTML: sort attributes, canonicalize boolean attributes,
 * unify quote escaping in text nodes and self-closing style.
 */

const BOOLEAN_ATTRS = new Set(['controls', 'disabled', 'autoplay', 'muted', 'loop']);

function normalizeTag(tag) {
  if (tag.startsWith('</')) return tag.toLowerCase().replace(/\s+/g, '');
  const selfClosing = /\/>$/.test(tag);
  const inner = tag.replace(/^<|\/?>$/g, '');
  const [name, ...rest] = inner.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [''];
  const attrs = [];
  for (const chunk of rest) {
    const eq = chunk.indexOf('=');
    if (eq === -1) {
      const key = chunk.toLowerCase();
      attrs.push([key, BOOLEAN_ATTRS.has(key) ? key : '']);
    } else {
      const key = chunk.slice(0, eq).toLowerCase();
      let value = chunk.slice(eq + 1).replace(/^"|"$/g, '');
      attrs.push([key, value]);
    }
  }
  attrs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const attrText = attrs
    .map(([key, value]) => (value === '' && BOOLEAN_ATTRS.has(key) ? ` ${key}="${key}"` : ` ${key}="${value}"`))
    .join('');
  void selfClosing;
  return `<${name.toLowerCase()}${attrText}>`;
}

function normalizeText(text) {
  return text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function normalizeHTML(html) {
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  return tokens
    .map((token) => (token.startsWith('<') ? normalizeTag(token) : normalizeText(token)))
    .join('');
}
