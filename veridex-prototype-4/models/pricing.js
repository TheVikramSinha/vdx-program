// Pricing model: cart operations and deterministic quotes. All amounts are integer minor units.
// v4: each line carries the licence metric the buyer chose for that SKU.
//   seat (per_seat)        → seats per product; each product keeps its own seat limit
//   pool (bundle_seat)     → one count of bundle seats shared by the bundle's modules; each person–module assignment uses one seat
//   fixed / quantity       → units × price (per module fee, flat fee, custom per-unit metrics); no seat limit
//   usage (per_usage)      → nothing up front; billed in arrears after an included allowance
// Charge types: recurring (monthly or annual, carries SMA) and one_time (setup services: charged once, no SMA, no cadence discount).
import { isInt, pctBps, lessBps } from './money.js';
import { sku as getSku, product, tier, unitPrice, isFixed, chargeOf, kindOf, metricsOf, defaultMetric, metricDef } from './catalog.js';

export const emptyCart = () => ({ lines: [], cadence: 'monthly' });
export const CADENCES = { monthly: { label: 'Monthly', months: 1 }, annual: { label: 'Annual (prepaid)', months: 12 } };

/** Validate the requested metric and quantities for a SKU. Returns {ok, error, line}. Quantities are counts only — never people. */
export function buildLine(cat, skuId, qty = {}) {
  const s = getSku(cat, skuId);
  if (!s || s.status !== 'published') return { ok: false, error: 'This offer is not available.' };
  const metric = qty.metric ?? defaultMetric(s);
  if (!metricsOf(s).includes(metric)) return { ok: false, error: `${s.name} is not sold with that licence metric.` };
  if (metric === 'bundle_seat') {
    const n = qty.bundleSeats, r = s.bundleSeatRule || { min: 1, max: 5000 };
    if (!isInt(n) || n < r.min || n > r.max) return { ok: false, error: `${s.name}: enter a whole number of bundle seats between ${r.min} and ${r.max}.` };
    return { ok: true, line: { skuId, metric, bundleSeats: n } };
  }
  if (s.type === 'bundle' && isFixed(s)) {
    const n = qty.packages, { min, max } = s.quantityRule;
    if (!isInt(n) || n < min || n > max) return { ok: false, error: `Enter a whole number of packages between ${min} and ${max}.` };
    return { ok: true, line: { skuId, metric, packages: n } };
  }
  const basis = s.type === 'bundle' ? 'seat' : metricDef(product(cat, s.components[0].productId), metric).basis;
  if (basis === 'usage') return { ok: true, line: { skuId, metric } };
  if (basis === 'fixed' || basis === 'quantity') {
    const d = metricDef(product(cat, s.components[0].productId), metric), n = qty.units ?? d.min;
    if (!isInt(n) || n < d.min || n > d.max) return { ok: false, error: `${s.name}: enter a whole number of ${d.unitLabel}s between ${d.min} and ${d.max}.` };
    return { ok: true, line: { skuId, metric, units: n } };
  }
  const { min, max } = s.quantityRule, seats = {};
  for (const c of s.components) {
    const p = product(cat, c.productId), n = qty.seats?.[c.productId];
    const noun = kindOf(p) === 'platform' ? 'user licences' : 'seats';
    if (!isInt(n) || n < min || n > max) return { ok: false, error: `${p.name}: enter a whole number of ${noun} between ${min} and ${max}.` };
    seats[c.productId] = n;
  }
  return { ok: true, line: { skuId, metric, seats } };
}
/** Add or replace: one line per SKU, so re-adding (even with another metric) never duplicates a charge. */
export function setLine(cart, cat, skuId, qty) {
  const r = buildLine(cat, skuId, qty);
  if (!r.ok) return r;
  const i = cart.lines.findIndex((l) => l.skuId === skuId);
  if (i >= 0) cart.lines[i] = r.line; else cart.lines.push(r.line);
  return { ok: true, replaced: i >= 0 };
}
export function removeLine(cart, skuId) { cart.lines = cart.lines.filter((l) => l.skuId !== skuId); }
export function setCadence(cart, cadence) { if (!CADENCES[cadence]) return false; cart.cadence = cadence; return true; }

/** Price one cart line. Recurring amounts are monthly. */
export function priceLine(cat, line) {
  const s = getSku(cat, line.skuId);
  if (!s) return { error: `Offer ${line.skuId} no longer exists.` };
  if (s.status !== 'published') return { error: `${s.name} is no longer sold.` };
  const metric = line.metric ?? defaultMetric(s);
  if (!metricsOf(s).includes(metric)) return { error: `${s.name}: that licence metric is no longer offered. Choose again.` };
  const chargeType = chargeOf(s), fixed = isFixed(s), oneTime = chargeType === 'one_time';
  const p0 = product(cat, s.components[0].productId);
  const def = s.type === 'bundle' ? (metric === 'bundle_seat' ? metricDef(null, 'bundle_seat') : { key: 'per_seat', label: 'Seats per module', basis: 'seat', isCustom: false, unitLabel: 'seat' }) : metricDef(p0, metric);
  const components = [];
  let list = 0, net = 0;
  for (const c of s.components) {
    const p = product(cat, c.productId);
    const base = { productId: c.productId, productName: p.name, kind: kindOf(p), tierId: c.tierId, tierName: tier(cat, c.productId, c.tierId).name };
    if (metric === 'bundle_seat') { components.push({ ...base, seats: null, units: null, pool: true, unitListMinor: unitPrice(cat, c.productId, c.tierId, 'per_seat') ?? null, unitNetMinor: null }); continue; }
    const unitList = unitPrice(cat, c.productId, c.tierId, metric);
    if (!isInt(unitList)) return { error: `${s.name}: price missing for ${def.label}.` };
    if (def.basis === 'usage') { components.push({ ...base, seats: null, units: null, unitListMinor: unitList, unitNetMinor: unitList }); continue; }
    if (def.basis === 'fixed' || def.basis === 'quantity') {
      if (!isInt(line.units) || line.units < 1) return { error: `${s.name}: invalid quantity.` };
      components.push({ ...base, seats: null, units: line.units, unitListMinor: unitList, unitNetMinor: unitList });
      list += unitList * line.units; net += unitList * line.units; continue;
    }
    const seats = fixed ? c.fixedSeats * line.packages : line.seats?.[c.productId];
    if (!isInt(seats) || seats < 1) return { error: `${s.name}: invalid quantity.` };
    const unitNet = fixed ? null : lessBps(unitList, s.discountBps || 0);
    components.push({ ...base, seats, units: null, unitListMinor: unitList, unitNetMinor: unitNet });
    list += unitList * seats;
    if (!fixed) net += unitNet * seats;
  }
  if (fixed) net = s.packagePriceMinor * line.packages;
  if (metric === 'bundle_seat') { if (!isInt(line.bundleSeats) || line.bundleSeats < 1) return { error: `${s.name}: invalid quantity.` }; net = list = s.bundleSeatPriceMinor * line.bundleSeats; }
  return { skuId: s.id, skuName: s.name, skuType: s.type, licenseMetric: metric, metricLabel: def.label, basis: def.basis, isCustomMetric: !!def.isCustom, chargeType, quantityType: s.quantityRule?.type,
    unitLabel: def.unitLabel || null, packages: fixed ? line.packages : null, packagePriceMinor: fixed ? s.packagePriceMinor : null, units: ['fixed', 'quantity'].includes(def.basis) ? line.units : null,
    bundleSeats: metric === 'bundle_seat' ? line.bundleSeats : null, bundleSeatPriceMinor: metric === 'bundle_seat' ? s.bundleSeatPriceMinor : null,
    usage: def.basis === 'usage' ? { rateMinor: components[0].unitListMinor, includedUnits: def.includedUnits, unitLabel: def.unitLabel } : null,
    discountBps: metric === 'per_seat' && s.type === 'bundle' ? s.discountBps || 0 : 0, components,
    monthlyListMinor: oneTime ? 0 : list, monthlyNetMinor: oneTime ? 0 : net, monthlySavingMinor: oneTime || metric === 'bundle_seat' ? 0 : Math.max(0, list - net), oneTimeMinor: oneTime ? net : 0 };
}

/** How a product is licensed in one place (line or entitlement). Two sources can only combine when both are per-seat at the same tier, or the same bundle pool. */
const licenceKey = (metric, tierId, poolId) => (metric === 'bundle_seat' ? `pool:${poolId}` : `${metric}:${tierId}`);
const canCombine = (a, b) => a === b && (a.startsWith('per_seat:') || a.startsWith('pool:'));

/**
 * Full quote. ctx.entitlements (optional) = what the workspace already holds, for overlap and platform-licence rules.
 * Order of charges: licence fees (after bundle discounts) + SMA % → × months → − annual prepay discount → + one-time services → tax.
 */
export function quote(cat, cart, ctx = {}) {
  const held = ctx.entitlements || {}, heldPools = ctx.pools || {};
  const errors = [], warnings = [], lines = [];
  for (const l of cart.lines) { const p = priceLine(cat, l); if (p.error) errors.push(p.error); else lines.push(p); }
  const byProduct = {}, capacity = {}, addons = [], services = [], access = [], pools = [];
  for (const l of lines) {
    if (l.chargeType === 'one_time') { for (const c of l.components) services.push({ ...c, skuId: l.skuId, skuName: l.skuName, unitLabel: l.unitLabel }); continue; }
    if (l.licenseMetric === 'bundle_seat') pools.push({ poolId: l.skuId, skuName: l.skuName, seats: l.bundleSeats, productNames: l.components.map((c) => c.productName), productIds: l.components.map((c) => c.productId) });
    for (const c of l.components) {
      (byProduct[c.productId] ||= { productName: c.productName, sources: [] }).sources.push({ key: licenceKey(l.licenseMetric, c.tierId, l.skuId), skuId: l.skuId, skuName: l.skuName, metricLabel: l.metricLabel, tierName: c.tierName, seats: c.seats });
      if (c.kind === 'addon') { addons.push({ ...c, skuId: l.skuId, skuName: l.skuName, licenseMetric: l.licenseMetric, metricLabel: l.metricLabel, usage: l.usage, units: c.units, unitLabel: l.unitLabel }); continue; }
      if (l.basis === 'seat') {
        const e = (capacity[c.productId] ||= { productId: c.productId, productName: c.productName, kind: c.kind, licenseMetric: 'per_seat', tiers: {}, seats: 0, sources: [] });
        e.tiers[c.tierId] = c.tierName; e.seats += c.seats; e.sources.push({ skuId: l.skuId, skuName: l.skuName, tierName: c.tierName, seats: c.seats });
      } else if (l.licenseMetric !== 'bundle_seat') access.push({ productId: c.productId, productName: c.productName, tierName: c.tierName, metricLabel: l.metricLabel, basis: l.basis, units: c.units, unitLabel: l.unitLabel, usage: l.usage });
    }
  }
  // Same product from two sources: only per-seat at the same tier (capacities add) or the same bundle pool. Anything else is one product licensed two ways.
  const conflicts = Object.entries(byProduct).filter(([, v]) => v.sources.length > 1 && !v.sources.every((x) => canCombine(x.key, v.sources[0].key)))
    .map(([productId, v]) => ({ productId, productName: v.productName, sources: v.sources }));
  const overlaps = Object.values(capacity).filter((e) => e.sources.length > 1 && !conflicts.some((c) => c.productId === e.productId));
  // Against what the workspace already holds.
  for (const [pid, v] of Object.entries(byProduct)) {
    const h = held[pid];
    if (!h) continue;
    const hk = licenceKey(h.licenseMetric, h.tierId, h.poolId);
    for (const src of v.sources) if (!canCombine(src.key, hk))
      errors.push(h.kind === 'addon' && (h.licenseMetric === src.key.split(':')[0])
        ? `${v.productName} is already active in this workspace. It is workspace-wide, so it cannot be bought twice.`
        : `${v.productName} is already licensed in this workspace (${h.metricLabel || h.licenseMetric}${h.tierName ? `, ${h.tierName}` : ''}). Buying it as “${src.metricLabel}${src.tierName ? `, ${src.tierName}` : ''}” is a plan change — request it in Tenant Admin.`);
  }
  // Platform user licences: required alongside any module access when the catalog says so.
  const st = cat.settings;
  const moduleAccess = Object.values(byProduct).length && lines.some((l) => l.components.some((c) => c.kind === 'module'));
  const userCap = Object.values(capacity).find((c) => c.kind === 'platform');
  const heldUsers = Object.values(held).find((e) => e.kind === 'platform');
  if (st.requirePlatformLicence && moduleAccess && !userCap && !heldUsers)
    errors.push('Module access needs VeriDex Core user licences: one for each person who will use any module. Add user licences to continue.');
  const users = (userCap?.seats || 0) + (heldUsers?.purchased || 0);
  const seatMods = Object.values(capacity).filter((c) => c.kind === 'module');
  const biggest = Math.max(0, ...seatMods.map((c) => c.seats + (held[c.productId]?.licenseMetric === 'per_seat' ? held[c.productId].purchased || 0 : 0)));
  if ((userCap || heldUsers) && users < biggest)
    warnings.push(`${users} user licence${users === 1 ? '' : 's'} for up to ${biggest} people in one module. Some module seats cannot be filled until you have more user licences.`);
  for (const pl of pools) if (pl.seats < pl.productIds.length)
    warnings.push(`${pl.skuName}: ${pl.seats} bundle seat${pl.seats === 1 ? '' : 's'} for ${pl.productIds.length} modules. One person in every module would use ${pl.productIds.length} seats.`);
  const months = CADENCES[cart.cadence].months;
  const monthlyListMinor = lines.reduce((n, l) => n + l.monthlyListMinor, 0);
  const monthlyNetMinor = lines.reduce((n, l) => n + l.monthlyNetMinor, 0);
  const smaMonthlyMinor = pctBps(monthlyNetMinor, st.smaBps || 0);
  const recurringMonthlyMinor = monthlyNetMinor + smaMonthlyMinor;
  const periodGrossMinor = recurringMonthlyMinor * months;
  const cadenceDiscountMinor = cart.cadence === 'annual' ? pctBps(periodGrossMinor, st.annualDiscountBps) : 0;
  const recurringPeriodMinor = periodGrossMinor - cadenceDiscountMinor;
  const oneTimeMinor = lines.reduce((n, l) => n + l.oneTimeMinor, 0);
  const subtotalMinor = recurringPeriodMinor + oneTimeMinor;
  const taxMinor = pctBps(subtotalMinor, st.taxBps);
  return { currency: st.currency, cadence: cart.cadence, months, lines, capacity: Object.values(capacity), pools, access, addons, services,
    usageTerms: lines.filter((l) => l.usage).map((l) => ({ skuId: l.skuId, skuName: l.skuName, ...l.usage })), conflicts, overlaps, errors: [...new Set(errors)], warnings,
    monthlyListMinor, monthlyNetMinor, bundleSavingMinor: lines.reduce((n, l) => n + l.monthlySavingMinor, 0), smaBps: st.smaBps || 0, smaMonthlyMinor, recurringMonthlyMinor,
    periodGrossMinor, cadenceDiscountMinor, annualDiscountBps: st.annualDiscountBps, recurringPeriodMinor, oneTimeMinor,
    subtotalMinor, taxBps: st.taxBps, taxMinor, totalDueMinor: subtotalMinor + taxMinor, monthlyEquivalentMinor: Math.round(recurringPeriodMinor / months),
    purchasable: lines.length > 0 && !errors.length && !conflicts.length };
}

/** Compare ways to cover a demand like {mod_claims:10, mod_legal:4}: individual per-seat modules vs each bundle (seats per module, fixed pack, shared bundle seats). */
export function compareDemand(cat, persona, demand) {
  const need = Object.entries(demand).filter(([, n]) => isInt(n) && n > 0);
  if (!need.length) return [];
  const out = [];
  const offers = cat.skus.filter((s) => s.status === 'published' && s.audience.includes(persona));
  const seatPrice = (pid, tid) => unitPrice(cat, pid, tid, 'per_seat');
  let ok = true, total = 0; const parts = [];
  for (const [pid, n] of need) {
    const cands = offers.filter((s) => s.type === 'standalone' && s.components[0].productId === pid && metricsOf(s).includes('per_seat')).sort((a, b) => seatPrice(pid, a.components[0].tierId) - seatPrice(pid, b.components[0].tierId));
    if (!cands.length) { ok = false; break; }
    const u = seatPrice(pid, cands[0].components[0].tierId);
    total += u * n; parts.push({ productId: pid, skuId: cands[0].id, label: cands[0].name, seats: n, need: n, unitMinor: u, excess: 0 });
  }
  if (ok) out.push({ kind: 'standalone', name: 'Individual modules', monthlyMinor: total, parts, excessSeats: 0, lines: parts.map((p) => ({ skuId: p.skuId, metric: 'per_seat', seats: { [p.productId]: p.seats } })) });
  for (const s of offers.filter((x) => x.type === 'bundle')) {
    const ids = s.components.map((c) => c.productId);
    if (!need.every(([pid]) => ids.includes(pid))) continue;
    const label = (c) => `${product(cat, c.productId).name} ${tier(cat, c.productId, c.tierId).name}`;
    if (metricsOf(s).includes('per_seat')) {
      const min = s.quantityRule.min;
      if (isFixed(s)) {
        const packs = Math.max(min, ...s.components.map((c) => Math.ceil((demand[c.productId] || 0) / c.fixedSeats)));
        const parts2 = s.components.map((c) => ({ productId: c.productId, label: label(c), seats: c.fixedSeats * packs, need: demand[c.productId] || 0, excess: c.fixedSeats * packs - (demand[c.productId] || 0) }));
        out.push({ kind: 'fixed', skuId: s.id, name: s.name, packages: packs, monthlyMinor: s.packagePriceMinor * packs, parts: parts2, excessSeats: parts2.reduce((n, p) => n + p.excess, 0), lines: [{ skuId: s.id, metric: 'per_seat', packages: packs }] });
      } else {
        const seats = {}; let m = 0;
        const parts2 = s.components.map((c) => {
          const n = Math.max(min, demand[c.productId] || 0); seats[c.productId] = n;
          const u = lessBps(seatPrice(c.productId, c.tierId), s.discountBps); m += u * n;
          return { productId: c.productId, label: label(c), seats: n, need: demand[c.productId] || 0, unitMinor: u, excess: n - (demand[c.productId] || 0) };
        });
        out.push({ kind: 'configurable', skuId: s.id, name: s.name, monthlyMinor: m, parts: parts2, excessSeats: parts2.reduce((n, p) => n + p.excess, 0), lines: [{ skuId: s.id, metric: 'per_seat', seats }] });
      }
    }
    if (metricsOf(s).includes('bundle_seat')) {
      // Each person–module assignment uses one bundle seat, so the pool needed is the sum of the per-module counts.
      const needed = need.reduce((n, [, x]) => n + x, 0), r = s.bundleSeatRule || { min: 1 }, seats = Math.max(r.min, needed);
      out.push({ kind: 'pool', skuId: s.id, name: `${s.name} — shared bundle seats`, monthlyMinor: s.bundleSeatPriceMinor * seats, bundleSeats: seats,
        parts: [{ label: `Bundle seats for ${s.components.map((c) => product(cat, c.productId).name).join(', ')}`, seats, need: needed, excess: seats - needed, unitMinor: s.bundleSeatPriceMinor }],
        excessSeats: seats - needed, lines: [{ skuId: s.id, metric: 'bundle_seat', bundleSeats: seats }] });
    }
  }
  return out;
}
