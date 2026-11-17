// Catalog model: products, tiers, SKUs, price book. Pure functions over a plain catalog object.
import { isInt } from './money.js';
export const priceKey = (productId, tierId) => `${productId}:${tierId}`;
export const product = (cat, id) => cat.products.find((p) => p.id === id);
export const tier = (cat, productId, tierId) => product(cat, productId)?.tiers.find((t) => t.id === tierId);
export const sku = (cat, id) => cat.skus.find((s) => s.id === id);
export const unitPrice = (cat, productId, tierId) => cat.prices[priceKey(productId, tierId)];
export const isFixed = (s) => s.quantityRule?.type === 'fixed_package';
export const metricOf = (s) => s?.licenseMetric || 'per_module';
export const chargeOf = (s) => s?.chargeType || 'recurring';
export const isOneTime = (s) => chargeOf(s) === 'one_time';
export const kindOf = (p) => p?.kind || 'module';
/** Which product kinds each licence metric may sell. */
export const METRIC_KINDS = { per_module: ['module'], per_user: ['platform'], flat: ['addon', 'service'], usage: ['addon'] };
/** Price unit wording for one SKU. */
export function priceUnit(s) {
  if (isOneTime(s)) return s.quantityRule?.max > 1 ? `one-time, per ${s.quantityRule.unitLabel}` : 'one-time';
  const m = metricOf(s);
  if (m === 'usage') return `per ${s.usage?.unitLabel || 'unit'}`;
  return { per_user: 'per user / month', per_module: 'per seat / month', flat: 'per month' }[m];
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
    for (const t of p.tiers || []) {
      const v = unitPrice(cat, p.id, t.id);
      if (p.status === 'active' && !(isInt(v) && v > 0)) err(`${p.name} ${t.name}`, 'Missing or invalid unit price.');
    }
  }
  const skuIds = new Set();
  for (const s of cat.skus) {
    const w = `${s.id} ${s.name || ''}`.trim();
    if (!/^[A-Z0-9][A-Z0-9-]{2,30}$/.test(s.id || '')) err(w, 'SKU id must be 3–31 characters: A–Z, 0–9, hyphen.');
    if (skuIds.has(s.id)) err(w, 'Duplicate SKU id.');
    skuIds.add(s.id);
    if (!s.name?.trim()) err(w, 'SKU needs a name.');
    if (!s.audience?.length) err(w, 'Select at least one audience.');
    const metric = metricOf(s), charge = chargeOf(s), qt = s.quantityRule?.type;
    if (!METRIC_KINDS[metric]) err(w, 'Choose a licence metric: per user, per module seat, flat fee or usage.');
    if (!['recurring', 'one_time'].includes(charge)) err(w, 'Charge type must be recurring or one-time.');
    for (const c of s.components) { const p = product(cat, c.productId); if (p && METRIC_KINDS[metric] && !METRIC_KINDS[metric].includes(kindOf(p))) err(w, `${p.name} is ${kindOf(p) === 'module' ? 'a seat-based module' : `a ${kindOf(p)} product`}; it cannot be sold with the “${metric.replace('_', ' ')}” metric.`); }
    if (metric !== 'per_module' && s.type === 'bundle') err(w, 'Bundles are sold per module seat.');
    if (metric === 'per_user' && !['per_module'].includes(qt)) err(w, 'A per-user SKU takes a user count.');
    if (metric === 'per_module' && !['per_module', 'fixed_package'].includes(qt)) err(w, 'A per-seat SKU takes a seat count per module or fixed packs.');
    if (metric === 'flat' && qt !== 'flat') err(w, 'A flat-fee SKU uses a flat quantity rule.');
    if (metric === 'usage') {
      if (qt !== 'usage') err(w, 'A usage SKU uses a usage quantity rule.');
      if (!(isInt(s.usage?.includedUnits) && s.usage.includedUnits >= 0)) err(w, 'Included usage must be a whole number (0 or more).');
      if (!s.usage?.unitLabel?.trim()) err(w, 'Name the usage unit, e.g. payment or document.');
    }
    if (metric === 'flat' && !s.quantityRule?.unitLabel?.trim()) err(w, 'Name the flat-fee unit, e.g. workspace or session.');
    if (charge === 'one_time' && metric !== 'flat') err(w, 'One-time charges use the flat-fee metric.');
    const kinds = s.components.map((c) => kindOf(product(cat, c.productId)));
    if (kinds.includes('service') && charge !== 'one_time') err(w, 'Setup services are charged once.');
    if (charge === 'one_time' && kinds.some((k) => k !== 'service')) err(w, 'Only setup services can be charged once.');
    if (s.type === 'standalone' && s.components.length !== 1) err(w, 'A standalone SKU contains exactly one module.');
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
      if (isFixed(s) && !(isInt(c.fixedSeats) && c.fixedSeats > 0)) err(w, `${p.name}: fixed seats per package must be a whole number above 0.`);
    }
    const q = s.quantityRule || {};
    if (q.type !== 'usage' && !(isInt(q.min) && isInt(q.max) && q.min >= 1 && q.max >= q.min)) err(w, 'Quantity rule needs whole-number min and max (min ≥ 1, max ≥ min).');
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
    if (!cat.skus.some((s) => s.status === 'published' && metricOf(s) === 'per_user' && s.audience.includes(persona)))
      err('Billing', `Modules require platform user licences, but no per-user SKU is published for the ${persona} journey.`);
  for (const p of cat.products.filter((x) => x.status === 'active' && ['module', 'platform'].includes(kindOf(x)))) for (const t of p.tiers) {
    if (!cat.skus.some((s) => s.type === 'standalone' && s.status === 'published' && s.components[0]?.productId === p.id && s.components[0]?.tierId === t.id))
      warn(`${p.name} ${t.name}`, 'No published standalone SKU: tenants cannot buy extra seats for this tier.');
  }
  return out;
}

/** Human-readable differences between two catalogs (for publish review). */
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
    out.push(`Price: ${componentLabel(b, { productId: pid, tierId: tid })} ${a.prices[k] == null ? '—' : (a.prices[k] / 100).toFixed(2)} → ${b.prices[k] == null ? '—' : (b.prices[k] / 100).toFixed(2)}`);
  }
  for (const k of Object.keys(b.settings)) if (a.settings[k] !== b.settings[k]) out.push(`Billing setting ${k}: ${a.settings[k]} → ${b.settings[k]}`);
  return out;
}
