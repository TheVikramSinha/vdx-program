// Money is always integer minor units (cents). No floats are stored.
export const isInt = (n) => Number.isInteger(n);
/** Basis-point percentage of an amount, rounded half-up to the nearest minor unit. */
export const pctBps = (minor, bps) => Math.round((minor * bps) / 10000);
export const lessBps = (minor, bps) => minor - pctBps(minor, bps);
const fmts = {};
export function fmt(minor, currency = 'USD') {
  fmts[currency] ||= new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return fmts[currency].format(minor / 100);
}
/** Parse "12", "12.5", "12.50" to minor units. Returns null for anything else. */
export function toMinor(input) {
  const s = String(input ?? '').trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number((f + '00').slice(0, 2));
}
export const fromMinor = (minor) => (minor / 100).toFixed(2);
/** Parse a percentage like "10" or "12.5" into basis points (0–10000), else null. */
export function toBps(input) {
  const s = String(input ?? '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return bps <= 10000 ? bps : null;
}
export const bpsLabel = (bps) => `${+(bps / 100).toFixed(2)}%`;
/** Strict positive-integer parse for quantities. */
export function toQty(input) {
  const s = String(input ?? '').trim();
  return /^\d{1,5}$/.test(s) ? Number(s) : null;
}
