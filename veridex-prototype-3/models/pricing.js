// Pricing model: cart operations and deterministic quotes. All amounts are integer minor units.
// Licence metrics: per_module (seats per module), per_user (platform user licences), flat (fixed fee), usage (billed in arrears).
// Charge types: recurring (monthly or annual, carries SMA) and one_time (setup services: charged once, no SMA, no cadence discount).
import { isInt, pctBps, lessBps } from './money.js';
import { sku as getSku, product, tier, unitPrice, isFixed, metricOf, chargeOf, kindOf } from './catalog.js';

export const emptyCart = () => ({ lines: [], cadence: 'monthly' });
export const CADENCES = { monthly: { label: 'Monthly', months: 1 }, annual: { label: 'Annual (prepaid)', months: 12 } };

/** Validate requested quantities for a SKU. Returns {ok, error, line}. Quantities are counts only — never people. */
export function buildLine(cat, skuId, qty) {
  const s = getSku(cat, skuId);
  if (!s || s.status !== 'published') return { ok: false, error: 'This offer is not available.' };
  const { min, max, type } = s.quantityRule;
  if (type === 'usage') return { ok: true, line: { skuId } };
  if (type === 'flat') {
    const n = qty?.units ?? 1;
    if (!isInt(n) || n < min || n > max) return { ok: false, error: `${s.name}: enter a whole number of ${s.quantityRule.unitLabel}s between ${min} and ${max}.` };
    return { ok: true, line: { skuId, units: n } };
  }
  if (isFixed(s)) {
    const n = qty?.packages;
    if (!isInt(n) || n < min || n > max) return { ok: false, error: `Enter a whole number of packages between ${min} and ${max}.` };
    return { ok: true, line: { skuId, packages: n } };
  }
  const seats = {};
  const noun = metricOf(s) === 'per_user' ? 'user licences' : 'seats';
  for (const c of s.components) {
    const n = qty?.seats?.[c.productId];
    if (!isInt(n) || n < min || n > max) return { ok: false, error: `${product(cat, c.productId).name}: enter a whole number of ${noun} between ${min} and ${max}.` };
    seats[c.productId] = n;
  }
  return { ok: true, line: { skuId, seats } };
}
/** Add or replace: one line per SKU, so re-adding never duplicates a charge. */
export function setLine(cart, cat, skuId, qty) {
  const r = buildLine(cat, skuId, qty);
  if (!r.ok) return r;
  const i = cart.lines.findIndex((l) => l.skuId === skuId);
  if (i >= 0) cart.lines[i] = r.line; else cart.lines.push(r.line);
  return { ok: true, replaced: i >= 0 };
}
export function removeLine(cart, skuId) { cart.lines = cart.lines.filter((l) => l.skuId !== skuId); }
export function setCadence(cart, cadence) { if (!CADENCES[cadence]) return false; cart.cadence = cadence; return true; }

/** Price one cart line. Returns the expanded entitlement and amounts. Recurring amounts are monthly. */
export function priceLine(cat, line) {
  const s = getSku(cat, line.skuId);
  if (!s) return { error: `Offer ${line.skuId} no longer exists.` };
  if (s.status !== 'published') return { error: `${s.name} is no longer sold.` };
  const metric = metricOf(s), chargeType = chargeOf(s), fixed = isFixed(s), qt = s.quantityRule.type;
  const components = [];
  let list = 0, net = 0;
  for (const c of s.components) {
    const unitList = unitPrice(cat, c.productId, c.tierId);
    if (!isInt(unitList)) return { error: `${s.name}: price missing.` };
    const base = { productId: c.productId, productName: product(cat, c.productId).name, kind: kindOf(product(cat, c.productId)), tierId: c.tierId, tierName: tier(cat, c.productId, c.tierId).name, unitListMinor: unitList };
    if (qt === 'usage') { components.push({ ...base, seats: null, units: null, unitNetMinor: unitList }); continue; }
    if (qt === 'flat') {
      const units = line.units;
      if (!isInt(units) || units < 1) return { error: `${s.name}: invalid quantity.` };
      components.push({ ...base, seats: null, units, unitNetMinor: unitList });
      list += unitList * units; net += unitList * units; continue;
    }
    const seats = fixed ? c.fixedSeats * line.packages : line.seats?.[c.productId];
    if (!isInt(seats) || seats < 1) return { error: `${s.name}: invalid quantity.` };
    const unitNet = fixed ? null : lessBps(unitList, s.discountBps || 0);
    components.push({ ...base, seats, units: null, unitNetMinor: unitNet });
    list += unitList * seats;
    if (!fixed) net += unitNet * seats;
  }
  if (fixed) net = s.packagePriceMinor * line.packages;
  const oneTime = chargeType === 'one_time';
  return { skuId: s.id, skuName: s.name, skuType: s.type, licenseMetric: metric, chargeType, quantityType: qt, unitLabel: s.quantityRule.unitLabel || null,
    packages: fixed ? line.packages : null, packagePriceMinor: fixed ? s.packagePriceMinor : null, units: qt === 'flat' ? line.units : null,
    usage: qt === 'usage' ? { rateMinor: components[0].unitListMinor, includedUnits: s.usage.includedUnits, unitLabel: s.usage.unitLabel } : null,
    discountBps: s.discountBps || 0, components,
    monthlyListMinor: oneTime ? 0 : list, monthlyNetMinor: oneTime ? 0 : net, monthlySavingMinor: oneTime ? 0 : Math.max(0, list - net), oneTimeMinor: oneTime ? net : 0 };
}

/**
 * Full quote. ctx.entitlements (optional) = what the workspace already holds, for overlap and platform-licence rules.
 * Order of charges: licence fees (after bundle discounts) + SMA % → × months → − annual prepay discount → + one-time services → tax.
 */
export function quote(cat, cart, ctx = {}) {
  const held = ctx.entitlements || {};
  const errors = [], warnings = [], lines = [];
  for (const l of cart.lines) { const p = priceLine(cat, l); if (p.error) errors.push(p.error); else lines.push(p); }
  const capacity = {}, addons = [], services = [];
  for (const l of lines) for (const c of l.components) {
    if (l.chargeType === 'one_time') { services.push({ ...c, skuId: l.skuId, skuName: l.skuName, unitLabel: l.unitLabel }); continue; }
    if (c.seats == null) { addons.push({ ...c, skuId: l.skuId, skuName: l.skuName, licenseMetric: l.licenseMetric, usage: l.usage }); continue; }
    const e = (capacity[c.productId] ||= { productId: c.productId, productName: c.productName, licenseMetric: l.licenseMetric, tiers: {}, seats: 0, sources: [] });
    e.tiers[c.tierId] = c.tierName; e.seats += c.seats; e.sources.push({ skuId: l.skuId, skuName: l.skuName, tierName: c.tierName, seats: c.seats });
  }
  const conflicts = Object.values(capacity).filter((e) => Object.keys(e.tiers).length > 1)
    .map((e) => ({ productId: e.productId, productName: e.productName, sources: e.sources }));
  const overlaps = Object.values(capacity).filter((e) => e.sources.length > 1 && Object.keys(e.tiers).length === 1);
  // Workspace-wide add-ons are bought once. Buying one again would charge twice for the same thing.
  for (const a of addons) if (held[a.productId]) errors.push(`${a.productName} is already active in this workspace. It is workspace-wide, so it cannot be bought twice.`);
  // Platform user licences: required alongside module seats when the catalog says so.
  const st = cat.settings;
  const cap = Object.values(capacity);
  const seatModules = cap.filter((c) => c.licenseMetric === 'per_module');
  const userLine = cap.find((c) => c.licenseMetric === 'per_user');
  const heldUsers = Object.values(held).find((e) => e.licenseMetric === 'per_user');
  if (st.requirePlatformLicence && seatModules.length && !userLine && !heldUsers)
    errors.push('Module seats need VeriDex Core user licences: one for each person who will use a module. Add user licences to continue.');
  const users = (userLine?.seats || 0) + (heldUsers?.purchased || 0);
  const biggest = Math.max(0, ...seatModules.map((c) => c.seats + (held[c.productId]?.purchased || 0)));
  if ((userLine || heldUsers) && users < biggest)
    warnings.push(`${users} user licence${users === 1 ? '' : 's'} for up to ${biggest} people in one module. Some module seats cannot be filled until you have more user licences.`);
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
  return { currency: st.currency, cadence: cart.cadence, months, lines, capacity: cap, addons, services, usageTerms: lines.filter((l) => l.usage).map((l) => ({ skuId: l.skuId, skuName: l.skuName, ...l.usage })),
    conflicts, overlaps, errors, warnings,
    monthlyListMinor, monthlyNetMinor, bundleSavingMinor: monthlyListMinor - monthlyNetMinor, smaBps: st.smaBps || 0, smaMonthlyMinor, recurringMonthlyMinor,
    periodGrossMinor, cadenceDiscountMinor, annualDiscountBps: st.annualDiscountBps, recurringPeriodMinor, oneTimeMinor,
    subtotalMinor, taxBps: st.taxBps, taxMinor, totalDueMinor: subtotalMinor + taxMinor, monthlyEquivalentMinor: Math.round(recurringPeriodMinor / months),
    purchasable: lines.length > 0 && !errors.length && !conflicts.length };
}
/** Compare ways to cover a demand like {mod_claims:10, mod_legal:4}: standalone vs each bundle that covers it. */
export function compareDemand(cat, persona, demand) {
  const need = Object.entries(demand).filter(([, n]) => isInt(n) && n > 0);
  if (!need.length) return [];
  const out = [];
  const offers = cat.skus.filter((s) => s.status === 'published' && s.audience.includes(persona));
  // Standalone at the lowest published tier per module.
  let ok = true, total = 0; const parts = [];
  for (const [pid, n] of need) {
    const cands = offers.filter((s) => s.type === 'standalone' && s.components[0].productId === pid).sort((a, b) => unitPrice(cat, pid, a.components[0].tierId) - unitPrice(cat, pid, b.components[0].tierId));
    if (!cands.length) { ok = false; break; }
    const u = unitPrice(cat, pid, cands[0].components[0].tierId);
    total += u * n; parts.push({ productId: pid, label: cands[0].name, seats: n, need: n, unitMinor: u, excess: 0 });
  }
  if (ok) out.push({ kind: 'standalone', name: 'Individual modules', monthlyMinor: total, parts, excessSeats: 0, lines: parts.map((p) => ({ skuId: offers.find((s) => s.name === p.label).id, seats: { [p.productId]: p.seats } })) });
  for (const s of offers.filter((x) => x.type === 'bundle')) {
    const ids = s.components.map((c) => c.productId);
    if (!need.every(([pid]) => ids.includes(pid))) continue;
    const min = s.quantityRule.min;
    if (isFixed(s)) {
      const packs = Math.max(min, ...s.components.map((c) => Math.ceil((demand[c.productId] || 0) / c.fixedSeats)));
      const parts2 = s.components.map((c) => ({ productId: c.productId, label: `${product(cat, c.productId).name} ${tier(cat, c.productId, c.tierId).name}`, seats: c.fixedSeats * packs, need: demand[c.productId] || 0, excess: c.fixedSeats * packs - (demand[c.productId] || 0) }));
      out.push({ kind: 'fixed', skuId: s.id, name: s.name, packages: packs, monthlyMinor: s.packagePriceMinor * packs, parts: parts2, excessSeats: parts2.reduce((n, p) => n + p.excess, 0), lines: [{ skuId: s.id, packages: packs }] });
    } else {
      const seats = {}; let m = 0;
      const parts2 = s.components.map((c) => {
        const n = Math.max(min, demand[c.productId] || 0); seats[c.productId] = n;
        const u = lessBps(unitPrice(cat, c.productId, c.tierId), s.discountBps); m += u * n;
        return { productId: c.productId, label: `${product(cat, c.productId).name} ${tier(cat, c.productId, c.tierId).name}`, seats: n, need: demand[c.productId] || 0, unitMinor: u, excess: n - (demand[c.productId] || 0) };
      });
      out.push({ kind: 'configurable', skuId: s.id, name: s.name, monthlyMinor: m, parts: parts2, excessSeats: parts2.reduce((n, p) => n + p.excess, 0), lines: [{ skuId: s.id, seats }] });
    }
  }
  return out;
}
