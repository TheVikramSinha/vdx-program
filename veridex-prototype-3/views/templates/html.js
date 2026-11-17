// Safe templating. Every interpolated value is HTML-escaped unless it is already a Safe template result.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const val = (v) => v == null || v === false || v === true ? '' : v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v);
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += val(vals[i]); });
  return new Safe(out);
}
/**
 * Re-render a region by morphing the existing DOM towards the new markup instead of replacing it.
 * Nodes that stay are reused, so keyboard focus, caret, in-progress typing and a click that started
 * before the update all survive (a change event on blur must not swallow the click that caused the blur).
 */
const busy = new WeakSet(), queued = new WeakMap();
export function render(root, tpl) {
  // Removing a focused node fires blur/change, which can ask for another render. Queue it instead of nesting.
  if (busy.has(root)) { queued.set(root, tpl); return; }
  busy.add(root);
  try {
    const t = document.createElement('template');
    t.innerHTML = String(tpl);
    morphChildren(root, t.content);
  } finally { busy.delete(root); }
  if (queued.has(root)) { const next = queued.get(root); queued.delete(root); render(root, next); }
}
const same = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName);
function morphChildren(from, to) {
  let f = from.firstChild;
  for (let n = to.firstChild; n;) {
    const next = n.nextSibling;
    let match = null;
    if (n.nodeType === 1 && n.id) match = [...from.children].find((c) => c.id === n.id && c.tagName === n.tagName) || null;
    if (!match && f && same(f, n) && !(f.nodeType === 1 && (f.id || n.id) && f.id !== n.id)) match = f;
    if (match) {
      if (match !== f) from.insertBefore(match, f); else f = f.nextSibling;
      if (n.nodeType === 1) morph(match, n); else if (match.nodeValue !== n.nodeValue) match.nodeValue = n.nodeValue;
    } else from.insertBefore(n, f);
    n = next;
  }
  while (f) { const next = f.nextSibling; if (f.parentNode === from) from.removeChild(f); f = next; }
}
function morph(from, to) {
  const valueChanged = from.getAttribute('value') !== to.getAttribute('value');
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name) && !(from.tagName === 'DETAILS' && a.name === 'open')) from.removeAttribute(a.name);
  for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  const tag = from.tagName;
  if (tag === 'TEXTAREA') { if (from.defaultValue !== to.textContent || document.activeElement !== from) { from.textContent = to.textContent; from.value = to.textContent; } return; }
  morphChildren(from, to);
  if (tag === 'INPUT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (from.type !== 'file' && (valueChanged || document.activeElement !== from)) from.value = to.getAttribute('value') ?? '';
  } else if (tag === 'OPTION') from.selected = to.hasAttribute('selected');
  else if (tag === 'SELECT' && ![...from.options].some((o) => o.hasAttribute('selected')) && from.options.length) from.selectedIndex = 0;
}
