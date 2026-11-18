// Catalog model: products, tiers, licence metrics, SKUs, price book. Pure functions over a plain catalog object.
// v4: a product enables one or more licence metrics (standard or new/custom); prices are keyed by product, tier and metric;
// a SKU offers a subset of its product's metrics and the buyer chooses one per order line.
import { isInt } from './money.js';

/** Standard licence metrics. basis decides how quantity and capacity work. */
export const METRICS = {
  per_seat: { label: 'Per seat', basis: 'seat', hint: 'Price × seats. One seat per person who uses the product.' },
  per_module: { label: 'Per module', basis: 'fixed', hint: 'One fee for the module. Any number of people can use it.' },
  per_usage: { label: 'Per usage', basis: 'usage', hint: 'Charged per unit used after a monthly allowance, billed in arrears.' },
  flat: { label: 'Flat fee', basis: 'fixed', hint: 'A fixed fee for the workspace, or per unit such as a training session.' },
  bundle_seat: { label: 'Bundle seats', basis: 'pool', hint: 'One pool of seats for the whole bundle. Each person–module assignment uses one seat.' },
};
/** Which standard metrics apply to which product kind (custom metrics apply to any kind except platform). */
export const APPLICABLE = { module: ['per_seat', 'per_module', 'per_usage'], platform: ['per_seat'], addon: ['flat', 'per_usage'], service: ['flat'] };
export const BUNDLE_METRICS = ['per_seat', 'bundle_seat'];
export const CUSTOM_BASES = { quantity: 'Price × quantity the buyer enters (per month)', usage: 'Metered usage after an allowance (billed in arrears)', fixed: 'One fixed fee' };
const BASIS_OF_CUSTOM = { quantity: 'quantity', usage: 'usage', fixed: 'fixed' };

export const priceKey = (productId, tierId, metric = 'per_seat') => `${productId}:${tierId}:${metric}`;
export const product = (cat, id) => cat.products.find((p) => p.id === id);
export const tier = (cat, productId, tierId) => product(cat, productId)?.tiers.find((t) => t.id === tierId);
export const sku = (cat, id) => cat.skus.find((s) => s.id === id);
export const unitPrice = (cat, productId, tierId, metric = 'per_seat') => cat.prices[priceKey(productId, tierId, metric)];
export const isFixed = (s) => s.quantityRule?.type === 'fixed_package';
export const chargeOf = (s) => s?.chargeType || 'recurring';
export const isOneTime = (s) => chargeOf(s) === 'one_time';
export const kindOf = (p) => p?.kind || 'module';
export const metricsOf = (s) => s?.licenseMetrics?.length ? s.licenseMetrics : ['per_seat'];
export const defaultMetric = (s) => (metricsOf(s).includes(s?.defaultMetric) ? s.defaultMetric : metricsOf(s)[0]);
export const isCustomKey = (k) => /^custom_/.test(k || '');
export const enabledMetrics = (p) => (p?.metrics || []).filter((m) => m.enabled);

/** Full definition of one metric as configured on a product (standard defaults + product settings, or a custom metric). */
export function metricDef(p, key) {
  if (key === 'bundle_seat') return { key, ...METRICS.bundle_seat, unitLabel: 'bundle seat' };
  const cfg = (p?.metrics || []).find((m) => m.key === key) || { key };
  if (isCustomKey(key)) return { key, label: cfg.name || 'Custom metric', basis: BASIS_OF_CUSTOM[cfg.basis] || 'quantity', hint: cfg.description || CUSTOM_BASES[cfg.basis] || '', isCustom: true,
    unitLabel: cfg.unitLabel || 'unit', includedUnits: cfg.includedUnits ?? 0, min: cfg.min ?? 1, max: cfg.max ?? (cfg.basis === 'fixed' ? 1 : 100000), enabled: !!cfg.enabled };
  const std = METRICS[key] || { label: key, basis: 'seat', hint: '' };
  const seatUnit = kindOf(p) === 'platform' ? 'user' : 'seat';
  return { key, ...std, label: kindOf(p) === 'platform' && key === 'per_seat' ? 'Per user' : std.label, isCustom: false,
    unitLabel: std.basis === 'seat' ? seatUnit : cfg.unitLabel || (key === 'per_module' ? 'module' : key === 'per_usage' ? 'unit' : 'workspace'),
    includedUnits: cfg.includedUnits ?? 0, min: cfg.min ?? 1, max: cfg.max ?? 1, enabled: cfg.enabled !== false };
}
/** Price unit wording for a SKU line, for a chosen metric. */
export function priceUnit(cat, s, metric = defaultMetric(s)) {
  if (metric === 'bundle_seat') return 'per bundle seat / month';
  const d = metricDef(product(cat, s.components[0]?.productId), metric);
  if (isOneTime(s)) return d.max > 1 ? `one-time, per ${d.unitLabel}` : 'one-time';
  if (d.basis === 'usage') return `per ${d.unitLabel}`;
  if (d.basis === 'seat') return `per ${d.unitLabel} / month`;
  if (d.basis === 'quantity') return `per ${d.unitLabel} / month`;
  return d.max > 1 ? `per ${d.unitLabel} / month` : 'per month';
}

/** SKUs a persona can buy from a published catalog. */
export function offersFor(cat, persona, type) {
  return cat.skus.filter((s) => s.status === 'published' && s.audience.includes(persona) && (!type || s.type === type));
}
export function componentLabel(cat, c) {
  return `${product(cat, c.productId)?.name ?? c.productId} ${tier(cat, c.productId, c.tierId)?.name ?? c.tierId}`;
}

/** Validate a whole catalog before publishing. Returns [{level, where, msg}]. */
export function validateCatalog(cat) {
  const out = [];
  const err = (where, msg) => out.push({ level: 'error', where, msg });
  const warn = (where, msg) => out.push({ level: 'warning', where, msg });
  const ids = new Set();
  for (const p of cat.products) {
    if (!p.name?.trim()) err(p.id, 'Product needs a name.');
    if (ids.has(p.id)) err(p.id, 'Duplicate product id.');
    ids.add(p.id);
    if (!p.tiers?.length) err(p.name, 'Product needs at least one tier.');
    if (!p.personas?.length) warn(p.name, 'No eligible persona: no one can buy this product.');
    const kind = kindOf(p), en = enabledMetrics(p);
    if (!en.length) err(p.name, 'Enable at least one licence metric.');
    const keys = new Set();
    for (const m of p.metrics || []) {
      if (keys.has(m.key)) err(p.name, `Metric “${m.name || m.key}” appears twice.`);
      keys.add(m.key);
      if (isCustomKey(m.key)) {
        if (!m.isCustom) err(p.name, `${m.name || m.key}: a metric that is not standard must be marked as new/custom.`);
        if (kind === 'platform') err(p.name, 'Platform access is always licensed per user; custom metrics are not allowed.');
        if (!m.name?.trim()) err(p.name, 'A custom metric needs a name, e.g. “Per vehicle”.');
        if (!m.unitLabel?.trim()) err(p.name, `${m.name || 'Custom metric'}: name the unit, e.g. vehicle.`);
        if (!CUSTOM_BASES[m.basis]) err(p.name, `${m.name || 'Custom metric'}: choose how it is charged.`);
        if (kind === 'service' && m.basis === 'usage') err(p.name, `${m.name}: setup services are charged once; usage is not allowed.`);
      } else if (!METRICS[m.key] || m.key === 'bundle_seat') err(p.name, `Unknown metric “${m.key}”.`);
      else if (m.enabled && !APPLICABLE[kind].includes(m.key)) err(p.name, `${METRICS[m.key].label} does not apply to ${kind} products.`);
      if (m.enabled) {
        const d = metricDef(p, m.key);
        if (d.basis === 'usage' && !(isInt(d.includedUnits) && d.includedUnits >= 0)) err(p.name, `${d.label}: included units must be a whole number (0 or more).`);
        if (['fixed', 'quantity'].includes(d.basis) && !(isInt(d.min) && isInt(d.max) && d.min >= 1 && d.max >= d.min)) err(p.name, `${d.label}: quantity limits must be whole numbers (min ≥ 1, max ≥ min).`);
        if (p.status === 'active') for (const t of p.tiers || []) {
          const v = unitPrice(cat, p.id, t.id, m.key);
          if (!(isInt(v) && v > 0)) err(`${p.name} ${t.name}`, `Missing or invalid price for ${d.label}.`);
        }
      }
    }
    if (kind === 'platform' && !en.some((m) => m.key === 'per_seat')) err(p.name, 'Platform access must be licensed per user.');
  }
  const skuIds = new Set();
  for (const s of cat.skus) {
    const w = `${s.id} ${s.name || ''}`.trim();
    if (!/^[A-Z0-9][A-Z0-9-]{2,30}$/.test(s.id || '')) err(w, 'SKU id must be 3–31 characters: A–Z, 0–9, hyphen.');
    if (skuIds.has(s.id)) err(w, 'Duplicate SKU id.');
    skuIds.add(s.id);
    if (!s.name?.trim()) err(w, 'SKU needs a name.');
    if (!s.audience?.length) err(w, 'Select at least one audience.');
    const ms = metricsOf(s), charge = chargeOf(s);
    if (!s.licenseMetrics?.length) err(w, 'Offer at least one licence metric.');
    if (!ms.includes(defaultMetric(s))) err(w, 'The default metric must be one of the offered metrics.');
    if (!['recurring', 'one_time'].includes(charge)) err(w, 'Charge type must be recurring or one-time.');
    if (s.type === 'standalone' && s.components.length !== 1) err(w, 'A standalone SKU contains exactly one product.');
    if (s.type === 'bundle' && s.components.length < 2) err(w, 'A bundle needs at least two modules.');
    const seen = new Set();
    for (const c of s.components) {
      const p = product(cat, c.productId);
      if (!p) { err(w, `Unknown product ${c.productId}.`); continue; }
      if (!tier(cat, c.productId, c.tierId)) err(w, `${p.name}: unknown tier.`);
      if (seen.has(c.productId)) err(w, `${p.name} appears twice. One tier per module in a SKU.`);
      seen.add(c.productId);
      if (s.status === 'published' && p.status !== 'active') err(w, `${p.name} is ${p.status}; a published SKU cannot include it.`);
      for (const a of s.audience || []) if (!p.personas.includes(a)) err(w, `${p.name} is not available to the ${a} persona.`);
      if (s.type === 'bundle') {
        if (kindOf(p) !== 'module') err(w, `${p.name}: bundles contain modules only.`);
        if (ms.includes('per_seat') && !enabledMetrics(p).some((m) => m.key === 'per_seat')) err(w, `${p.name} is not licensed per seat, so it cannot be in a per-seat bundle.`);
        if (isFixed(s) && !(isInt(c.fixedSeats) && c.fixedSeats > 0)) err(w, `${p.name}: fixed seats per package must be a whole number above 0.`);
      } else for (const m of ms) if (!enabledMetrics(p).some((x) => x.key === m)) err(w, `${metricDef(p, m).label} is not enabled on ${p.name}.`);
      if (kindOf(p) === 'service' && charge !== 'one_time') err(w, 'Setup services are charged once.');
      if (charge === 'one_time' && kindOf(p) !== 'service') err(w, 'Only setup services can be charged once.');
    }
    if (s.type === 'bundle') {
      for (const m of ms) if (!BUNDLE_METRICS.includes(m)) err(w, 'Bundles are licensed with seats per module or bundle seats.');
      if (isFixed(s) && ms.includes('bundle_seat')) err(w, 'A fixed pack cannot also offer bundle seats.');
      if (ms.includes('bundle_seat')) {
        if (!(isInt(s.bundleSeatPriceMinor) && s.bundleSeatPriceMinor > 0)) err(w, 'Bundle seats need a price per bundle seat.');
        const r = s.bundleSeatRule || {};
        if (!(isInt(r.min) && isInt(r.max) && r.min >= 1 && r.max >= r.min)) err(w, 'Bundle seat limits must be whole numbers (min ≥ 1, max ≥ min).');
      }
    }
    const q = s.quantityRule || {};
    if (ms.some((m) => m === 'per_seat') && !(isInt(q.min) && isInt(q.max) && q.min >= 1 && q.max >= q.min)) err(w, 'Seat limits need whole-number min and max (min ≥ 1, max ≥ min).');
    if (isFixed(s)) {
      if (!(isInt(s.packagePriceMinor) && s.packagePriceMinor > 0)) err(w, 'Fixed package needs a package price.');
      else {
        const list = s.components.reduce((n, c) => n + (unitPrice(cat, c.productId, c.tierId) || 0) * (c.fixedSeats || 0), 0);
        if (s.packagePriceMinor > list) warn(w, 'Package price is higher than buying the same seats standalone.');
      }
    } else if (!(isInt(s.discountBps) && s.discountBps >= 0 && s.discountBps <= 6000)) err(w, 'Bundle discount must be between 0% and 60%.');
    if (s.type === 'standalone' && s.discountBps) err(w, 'Standalone SKUs carry no bundle discount.');
  }
  const st = cat.settings;
  if (!(isInt(st.annualDiscountBps) && st.annualDiscountBps >= 0 && st.annualDiscountBps <= 5000)) err('Billing', 'Annual prepay discount must be between 0% and 50%.');
  if (!(isInt(st.taxBps) && st.taxBps >= 0 && st.taxBps <= 3000)) err('Billing', 'Demo tax estimate must be between 0% and 30%.');
  if (!(isInt(st.smaBps) && st.smaBps >= 0 && st.smaBps <= 5000)) err('Billing', 'Hosted access & support (SMA) must be between 0% and 50%.');
  if (st.requirePlatformLicence) for (const persona of ['tenant', 'carrier'])
    if (!cat.skus.some((s) => s.status === 'published' && s.audience.includes(persona) && s.components.some((c) => kindOf(product(cat, c.productId)) === 'platform')))
      err('Billing', `Modules require platform user licences, but no user-licence SKU is published for the ${persona} journey.`);
  for (const p of cat.products.filter((x) => x.status === 'active' && ['module', 'platform'].includes(kindOf(x)) && enabledMetrics(x).some((m) => m.key === 'per_seat'))) for (const t of p.tiers) {
    if (!cat.skus.some((s) => s.type === 'standalone' && s.status === 'published' && metricsOf(s).includes('per_seat') && s.components[0]?.productId === p.id && s.components[0]?.tierId === t.id))
      warn(`${p.name} ${t.name}`, 'No published per-seat standalone SKU: tenants cannot buy extra seats for this tier.');
  }
  return out;
}

export function diffCatalog(a, b) {
  const out = [];
  const by = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const pa = by(a.products), pb = by(b.products), sa = by(a.skus), sb = by(b.skus);
  for (const id in pb) if (!pa[id]) out.push(`New product: ${pb[id].name}`); else if (JSON.stringify(pa[id]) !== JSON.stringify(pb[id])) out.push(`Product changed: ${pb[id].name}${pa[id].status !== pb[id].status ? ` (${pa[id].status} → ${pb[id].status})` : ''}`);
  for (const id in pa) if (!pb[id]) out.push(`Product removed: ${pa[id].name}`);
  for (const id in sb) if (!sa[id]) out.push(`New SKU: ${id} ${sb[id].name} (${sb[id].status})`); else if (JSON.stringify(sa[id]) !== JSON.stringify(sb[id])) out.push(`SKU changed: ${id} ${sb[id].name}${sa[id].status !== sb[id].status ? ` (${sa[id].status} → ${sb[id].status})` : ''}`);
  for (const id in sa) if (!sb[id]) out.push(`SKU removed: ${id}`);
  for (const k of new Set([...Object.keys(a.prices), ...Object.keys(b.prices)])) if (a.prices[k] !== b.prices[k]) {
    const [pid, tid] = k.split(':');
    const mk = k.split(':')[2];
    out.push(`Price: ${componentLabel(b, { productId: pid, tierId: tid })} · ${metricDef(product(b, pid) || product(a, pid), mk).label} ${a.prices[k] == null ? '—' : (a.prices[k] / 100).toFixed(2)} → ${b.prices[k] == null ? '—' : (b.prices[k] / 100).toFixed(2)}`);
  }
  for (const k of Object.keys(b.settings)) if (a.settings[k] !== b.settings[k]) out.push(`Billing setting ${k}: ${a.settings[k]} → ${b.settings[k]}`);
  return out;
}
