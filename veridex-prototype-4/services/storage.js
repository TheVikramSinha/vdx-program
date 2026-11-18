// Storage adapter. Browser localStorage in the app, in-memory in tests. Not a secure backend — see docs/ARCHITECTURE.md.
import { createPlatform } from '../models/platform.js';
import { createWorkspace } from '../models/workspace.js';
import { emptyCart } from '../models/pricing.js';

export const SCHEMA = 5;
const PREFIX = 'vdx.demo.';
const KEYS = ['platform', 'ws.tenant', 'ws.carrier', 'draft.tenant', 'draft.carrier'];
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let backend = typeof localStorage !== 'undefined' ? localStorage : memory();
export const useMemoryBackend = () => { backend = memory(); };

export const createDraft = (persona) => ({ seq: 0, persona, cart: emptyCart(), checkout: null, contact: {}, sessionId: null, confirmations: {}, lastOrderId: null, savedQuotes: [], intake: {}, ui: { tab: 'modules', qty: {}, tier: {}, demand: {}, method: 'approve' }, chat: { messages: [], open: false, specialist: 'online' } });
const factory = (key) => key === 'platform' ? createPlatform() : key.startsWith('ws.') ? createWorkspace(key.slice(3)) : createDraft(key.slice(6));

export const incompatible = [];
export function load(key) {
  const raw = backend.getItem(PREFIX + key);
  if (raw == null) return factory(key);
  try {
    const box = JSON.parse(raw);
    if (box.schema !== SCHEMA || typeof box.data !== 'object' || !box.data) throw new Error('schema');
    return box.data;
  } catch {
    // Be honest: an older or damaged draft cannot be opened. Keep it aside rather than guessing at a migration.
    backend.setItem(PREFIX + key + '.incompatible', raw);
    backend.removeItem(PREFIX + key);
    if (!incompatible.includes(key)) incompatible.push(key);
    return factory(key);
  }
}
export function save(key, data) { backend.setItem(PREFIX + key, JSON.stringify({ schema: SCHEMA, savedAt: new Date().toISOString(), data })); }
export function resetAll() { for (const k of KEYS) { backend.removeItem(PREFIX + k); backend.removeItem(PREFIX + k + '.incompatible'); } }
export function exportAll() {
  return { app: 'veridex-prototype', schema: SCHEMA, exportedAt: new Date().toISOString(), note: 'Synthetic demo data only.', data: Object.fromEntries(KEYS.map((k) => [k, load(k)])) };
}
/** Validate an imported file before anything is written. Returns {ok, error}. */
export function importAll(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== 'veridex-prototype') return { ok: false, error: 'This is not a VeriDex prototype export.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: `This export uses data version ${obj.schema}; this prototype reads version ${SCHEMA}. It cannot be imported.` };
  const d = obj.data;
  if (!d || typeof d !== 'object') return { ok: false, error: 'The export has no data section.' };
  for (const k of KEYS) if (!d[k] || typeof d[k] !== 'object') return { ok: false, error: `The export is missing “${k}”.` };
  const p = d.platform;
  if (!p.catalog?.published?.skus || !Array.isArray(p.orders) || !Array.isArray(p.leads) || !Array.isArray(p.cartSessions)) return { ok: false, error: 'The platform section is malformed.' };
  for (const k of ['ws.tenant', 'ws.carrier']) if (!Array.isArray(d[k].members) || !Array.isArray(d[k].assignments) || typeof d[k].entitlements !== 'object') return { ok: false, error: `The workspace section “${k}” is malformed.` };
  for (const k of ['draft.tenant', 'draft.carrier']) if (!Array.isArray(d[k].cart?.lines)) return { ok: false, error: `The draft section “${k}” is malformed.` };
  for (const k of KEYS) save(k, d[k]);
  return { ok: true };
}
