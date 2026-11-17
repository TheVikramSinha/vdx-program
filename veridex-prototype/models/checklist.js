// Checklist engine. Items are either derived ("auto") or explicit confirmations bound to a hash of the data they cover.
// Editing the covered data changes the hash, which invalidates the confirmation. A confirmation is a UX gate, not a legal consent record.
import { hash } from './ids.js';
export function evaluate(defs, ctx, confirmations = {}) {
  return defs.filter((d) => !d.when || d.when(ctx)).map((d) => {
    if (d.kind === 'auto') return { id: d.id, label: d.label, hint: d.hint, required: d.required, kind: 'auto', done: !!d.check(ctx), stale: false };
    const h = hash(d.covers ? d.covers(ctx) : '');
    const saved = confirmations[d.id];
    return { id: d.id, label: d.label, hint: d.hint, required: d.required, kind: 'confirm', done: saved === h, stale: saved != null && saved !== h };
  });
}
export function setConfirmation(defs, ctx, confirmations, id, on) {
  const d = defs.find((x) => x.id === id && x.kind === 'confirm');
  if (!d) throw new Error('Unknown checklist item.');
  if (on) confirmations[id] = hash(d.covers ? d.covers(ctx) : ''); else delete confirmations[id];
}
export const gate = (items) => ({ ok: items.every((i) => !i.required || i.done), missing: items.filter((i) => i.required && !i.done), skipped: items.filter((i) => !i.required && !i.done) });
