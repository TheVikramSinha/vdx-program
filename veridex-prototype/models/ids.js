/** Deterministic, per-aggregate sequential ids (no emails or names used as keys). */
export function nextId(owner, prefix) {
  owner.seq = (owner.seq || 0) + 1;
  return `${prefix}_${String(owner.seq).padStart(4, '0')}`;
}
export function hash(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const clone = (o) => JSON.parse(JSON.stringify(o));
/** Clock indirection so demo scenarios and tests can be deterministic. */
export const clock = { fixed: null, now() { return this.fixed || new Date().toISOString(); } };
