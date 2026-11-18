// Platform (VeriDex-side) aggregate: draft + published catalog with versions, orders, billing events, leads, audit.
import { seedCatalog } from '../data/seedCatalog.js';
import { validateCatalog, diffCatalog } from './catalog.js';
import { clone, nextId, clock } from './ids.js';

export const PLATFORM_ROLES = {
  platform_admin: { label: 'Platform administrator', can: ['catalog.edit', 'catalog.publish', 'customers.view', 'leads.manage'] },
  catalog_manager: { label: 'Catalog manager', can: ['catalog.edit', 'customers.view'] },
  pricing_approver: { label: 'Pricing approver', can: ['catalog.publish', 'customers.view'] },
  support_readonly: { label: 'Support (read-only)', can: ['customers.view'] },
};
export const can = (platform, action) => PLATFORM_ROLES[platform.role]?.can.includes(action) ?? false;
function need(platform, action) { if (!can(platform, action)) throw new Error(`Your platform role (${PLATFORM_ROLES[platform.role].label}) cannot do this.`); }

export function createPlatform(now = '2026-11-17T09:00:00.000Z') {
  const cat = seedCatalog();
  return { seq: 0, role: 'platform_admin',
    catalog: { version: 1, published: clone(cat), draft: clone(cat), scheduled: null, history: [{ version: 1, at: now, by: 'Seed data', changes: ['Initial illustrative catalog'] }] },
    orders: [], billingEvents: [], leads: [], audit: [], cartSessions: [], cartSettings: { abandonAfterMinutes: 60 } };
}
export function audit(platform, action, detail, now = clock.now()) {
  platform.audit.unshift({ id: nextId(platform, 'aud'), at: now, role: platform.role, action, detail });
  if (platform.audit.length > 200) platform.audit.length = 200;
}
export const draftChanges = (platform) => diffCatalog(platform.catalog.published, platform.catalog.draft);

export function saveProduct(platform, input) {
  need(platform, 'catalog.edit');
  const d = platform.catalog.draft;
  const name = (input.name || '').trim();
  if (!name) throw new Error('Product name is required.');
  const tiers = (input.tiers || []).filter((t) => t.name?.trim());
  if (!tiers.length) throw new Error('Add at least one tier.');
  let p = input.id && d.products.find((x) => x.id === input.id);
  if (!p) {
    const code = (input.code || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'MOD';
    p = { id: nextId(platform, 'mod'), code, tiers: [] };
    d.products.push(p);
  }
  Object.assign(p, { kind: ['module', 'platform', 'addon', 'service'].includes(input.kind) ? input.kind : (p.kind || 'module'), name, summary: (input.summary || '').trim(), description: (input.description || '').trim(), personas: input.personas || [], status: input.status || 'draft' });
  p.tiers = tiers.map((t, i) => ({ id: t.id || p.tiers[i]?.id || `tier${i + 1}_${t.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')}`, name: t.name.trim(), features: (t.features || []).map((f) => f.trim()).filter(Boolean) }));
  if (input.metrics) p.metrics = normaliseMetrics(input.metrics, p.metrics || []);
  else p.metrics ||= [{ key: p.kind === 'addon' || p.kind === 'service' ? 'flat' : 'per_seat', enabled: true }];
  // A SKU may only offer metrics its product has enabled: disabling a metric removes it from the product's draft SKUs.
  const on = new Set(p.metrics.filter((m) => m.enabled).map((m) => m.key));
  for (const s of d.skus.filter((x) => x.type === 'standalone' && x.components[0]?.productId === p.id)) {
    const keep = (s.licenseMetrics || []).filter((k) => on.has(k));
    s.licenseMetrics = keep.length ? keep : [...on].slice(0, 1);
    if (!s.licenseMetrics.includes(s.defaultMetric)) s.defaultMetric = s.licenseMetrics[0];
  }
  audit(platform, 'Draft: product saved', `${p.name} · metrics: ${p.metrics.filter((m) => m.enabled).map((m) => m.name || m.key).join(', ') || 'none'}`);
  return p;
}
/**
 * Metric list for a product: standard metrics switched on/off, plus new/custom metrics.
 * A custom metric is only accepted when it is explicitly marked as new/custom (isCustom: true).
 */
function normaliseMetrics(list, prev) {
  const out = [], used = new Set();
  for (const m of list) {
    if (m.isCustom || /^custom_/.test(m.key || '')) {
      if (!m.isCustom) throw new Error(`“${m.name || m.key}” is not a standard metric. Tick “New/custom metric” to add it.`);
      const name = String(m.name || '').trim();
      if (!name) throw new Error('A new/custom metric needs a name, e.g. “Per vehicle”.');
      let key = m.key && /^custom_/.test(m.key) ? m.key : `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'metric'}`;
      while (used.has(key)) key += '_2';
      used.add(key);
      const basis = ['quantity', 'usage', 'fixed'].includes(m.basis) ? m.basis : 'quantity';
      out.push({ key, enabled: m.enabled !== false, isCustom: true, name, basis, unitLabel: String(m.unitLabel || '').trim(), description: String(m.description || '').trim(),
        includedUnits: basis === 'usage' ? Number(m.includedUnits) || 0 : undefined, min: basis === 'usage' ? undefined : Number(m.min) || 1, max: basis === 'usage' ? undefined : Number(m.max) || (basis === 'fixed' ? 1 : 100000) });
    } else {
      if (used.has(m.key)) continue;
      used.add(m.key);
      const old = prev.find((x) => x.key === m.key) || {};
      out.push({ ...old, ...m, key: m.key, enabled: !!m.enabled });
    }
  }
  return out;
}
export function setPrice(platform, key, minor) {
  need(platform, 'catalog.edit');
  if (!Number.isInteger(minor) || minor <= 0) throw new Error('Enter a price above 0, e.g. 42.00.');
  platform.catalog.draft.prices[key] = minor;
  audit(platform, 'Draft: price set', `${key} = ${(minor / 100).toFixed(2)}`);
}
export function setSetting(platform, key, value) {
  need(platform, 'catalog.edit');
  if (!Number.isInteger(value) || value < 0) throw new Error('Enter a valid percentage.');
  platform.catalog.draft.settings[key] = value;
  audit(platform, 'Draft: billing setting', `${key} = ${value}`);
}
export function setFlag(platform, key, value) {
  need(platform, 'catalog.edit');
  if (!['requirePlatformLicence'].includes(key)) throw new Error('Unknown setting.');
  platform.catalog.draft.settings[key] = !!value;
  audit(platform, 'Draft: billing setting', `${key} = ${!!value}`);
}
export function saveSku(platform, input, originalId) {
  need(platform, 'catalog.edit');
  const d = platform.catalog.draft;
  const s = clone(input);
  s.id = (s.id || '').trim().toUpperCase();
  if (!s.id) throw new Error('SKU id is required.');
  const i = d.skus.findIndex((x) => x.id === (originalId || s.id));
  if (originalId && originalId !== s.id) throw new Error('SKU ids are stable. Create a new SKU instead of renaming the id.');
  if (!originalId && i >= 0) throw new Error('That SKU id already exists.');
  if (i >= 0) d.skus[i] = s; else d.skus.push(s);
  audit(platform, 'Draft: SKU saved', `${s.id} ${s.name}`);
  return s;
}
export function setSkuStatus(platform, id, status) {
  need(platform, 'catalog.edit');
  const s = platform.catalog.draft.skus.find((x) => x.id === id);
  if (!s) throw new Error('SKU not found.');
  s.status = status; audit(platform, 'Draft: SKU status', `${id} → ${status}`);
}
export function discardDraft(platform) {
  need(platform, 'catalog.edit');
  platform.catalog.draft = clone(platform.catalog.published); audit(platform, 'Draft discarded', '');
}
/** Publish the draft as a new immutable catalog version (optionally scheduled). Existing orders keep their own price snapshot. */
export function publish(platform, { effectiveAt = null, now = clock.now(), by } = {}) {
  need(platform, 'catalog.publish');
  const c = platform.catalog;
  const issues = validateCatalog(c.draft).filter((x) => x.level === 'error');
  if (issues.length) throw new Error(`Fix ${issues.length} validation error${issues.length > 1 ? 's' : ''} before publishing.`);
  const changes = draftChanges(platform);
  if (!changes.length) throw new Error('There are no draft changes to publish.');
  if (effectiveAt && effectiveAt > now) {
    c.scheduled = { snapshot: clone(c.draft), effectiveAt, changes, by: by || platform.role, at: now };
    audit(platform, 'Catalog scheduled', `Effective ${effectiveAt}`, now);
    return { scheduled: true };
  }
  c.published = clone(c.draft); c.version += 1; c.scheduled = null;
  c.history.unshift({ version: c.version, at: now, by: by || PLATFORM_ROLES[platform.role].label, changes });
  audit(platform, 'Catalog published', `Version ${c.version}`, now);
  return { version: c.version };
}
/** Promote a due scheduled catalog. Called on load by storefront and admin. */
export function promoteScheduled(platform, now = clock.now(), force = false) {
  const c = platform.catalog;
  if (!c.scheduled || (!force && c.scheduled.effectiveAt > now)) return false;
  c.published = clone(c.scheduled.snapshot); c.version += 1;
  c.history.unshift({ version: c.version, at: now, by: `${c.scheduled.by} (scheduled)`, changes: c.scheduled.changes });
  c.scheduled = null; audit(platform, 'Scheduled catalog went live', `Version ${c.version}`, now);
  return true;
}
export function cancelScheduled(platform) { need(platform, 'catalog.publish'); platform.catalog.scheduled = null; audit(platform, 'Scheduled publish cancelled', ''); }
