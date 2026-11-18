// Orders model: checkout sessions, idempotent payment recording, entitlement creation, seat purchases and reductions.
// The payment RESULT comes from a payment adapter (services/paymentMock.js); this model never fabricates one.
import { quote, emptyCart } from './pricing.js';
import { offersFor, metricsOf } from './catalog.js';
import { pctBps } from './money.js';
import { nextId, hash, clone, clock } from './ids.js';
import { log } from './workspace.js';

const DAY = 86400000;
const addMonths = (iso, m) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString(); };

/** Open (or reuse) a checkout session for the current cart. The session id is the payment idempotency key. */
export const heldCtx = (ws) => ({ entitlements: ws?.entitlements || {}, pools: ws?.pools || {} });
export function openCheckout(draft, cat, ws) {
  const q = quote(cat, draft.cart, heldCtx(ws));
  if (!q.purchasable) throw new Error(q.conflicts.length ? 'Resolve tier conflicts before checkout.' : q.errors[0] || 'Your order has nothing purchasable.');
  const cartHash = hash([draft.cart, q.totalDueMinor]);
  const s = draft.checkout;
  if (s && s.cartHash === cartHash && s.status !== 'paid') return s;
  draft.checkout = { id: nextId(draft, 'chk'), cartHash, status: 'open', attempts: [], orderId: null };
  return draft.checkout;
}
export function validateContact(c = {}) {
  const e = {};
  if (!(c.name || '').trim()) e.name = 'Enter the purchaser name for the receipt.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((c.email || '').trim())) e.email = 'Enter a valid receipt email, e.g. name@company.com.';
  return e;
}
const sameLicence = (e, l, c) => (e.licenseMetric === 'bundle_seat' ? l.licenseMetric === 'bundle_seat' && e.poolId === l.skuId : e.licenseMetric === 'per_seat' && l.licenseMetric === 'per_seat' && e.tierId === c.tierId);
function applyOrder(ws, order, now) {
  ws.pools ||= {}; ws.services ||= [];
  for (const l of order.lines) for (const c of l.components) {
    if (l.chargeType === 'one_time') continue;
    const e = ws.entitlements[c.productId];
    if (e && e.tierId !== c.tierId) throw new Error(`${c.productName}: this workspace holds ${e.tierName}; ${c.tierName} cannot be added without a plan change.`);
    if (e && !sameLicence(e, l, c)) throw new Error(`${c.productName} is already licensed in this workspace (${e.metricLabel}). Changing how it is licensed is a plan change.`);
  }
  for (const l of order.lines) {
    if (l.chargeType === 'one_time') {
      // One-time setup services: a delivery record, not an entitlement. Nothing renews.
      ws.services.push({ id: nextId(ws, 'svc'), orderId: order.id, skuId: l.skuId, skuName: l.skuName, units: l.units, unitLabel: l.unitLabel, amountMinor: l.oneTimeMinor, status: 'to_schedule', createdAt: now });
      continue;
    }
    if (l.licenseMetric === 'bundle_seat') {
      // One pool of bundle seats per bundle SKU; its modules draw from it.
      const pool = (ws.pools[l.skuId] ||= { poolId: l.skuId, name: l.skuName, productIds: l.components.map((c) => c.productId), purchased: 0 });
      pool.purchased += l.bundleSeats;
    }
    for (const c of l.components) {
      const e = (ws.entitlements[c.productId] ||= { productId: c.productId, productName: c.productName, kind: c.kind, tierId: c.tierId, tierName: c.tierName,
        licenseMetric: l.licenseMetric, metricLabel: l.metricLabel, basis: l.basis, isCustomMetric: l.isCustomMetric, poolId: l.licenseMetric === 'bundle_seat' ? l.skuId : null,
        purchased: l.basis === 'seat' ? 0 : null, units: null, unitLabel: l.unitLabel, enabled: true, visible: true });
      if (l.basis === 'seat') e.purchased += c.seats;
      if (c.units != null) e.units = (e.units || 0) + c.units;
      if (l.usage) e.usage = { ...l.usage, used: 0, periodStart: now };
    }
    ws.subscriptions.push({ id: nextId(ws, 'sub'), orderId: order.id, skuId: l.skuId, skuName: l.skuName, skuType: l.skuType, licenseMetric: l.licenseMetric, metricLabel: l.metricLabel, isCustomMetric: l.isCustomMetric,
      catalogVersion: order.catalogVersion, packages: l.packages, units: l.units, unitLabel: l.unitLabel, bundleSeats: l.bundleSeats, usage: l.usage, components: clone(l.components), cadence: order.cadence,
      monthlyNetMinor: l.monthlyNetMinor, smaBps: order.smaBps || 0, startedAt: now, renewsAt: order.renewsAt, status: 'active' });
  }
  ws.orders.push(order.id);
}
/**
 * Record a payment adapter result against the checkout session.
 * Approved → exactly one order + entitlements (repeat calls return the same order). Declined/cancelled → billing event only.
 */
export function recordPayment({ platform, ws, draft, result, contact, now = clock.now() }) {
  const s = draft.checkout;
  if (!s) throw new Error('No checkout session.');
  if (s.orderId) return { order: platform.orders.find((o) => o.id === s.orderId), duplicate: true };
  const cat = platform.catalog.published;
  const q = quote(cat, draft.cart, heldCtx(ws));
  if (!q.purchasable || hash([draft.cart, q.totalDueMinor]) !== s.cartHash) throw new Error('Your order changed. Review it again before paying.');
  s.attempts.push({ at: now, status: result.status, ref: result.ref });
  platform.billingEvents.unshift({ id: nextId(platform, 'evt'), at: now, type: `payment_${result.status}`, sessionId: s.id, persona: ws.persona, amountMinor: q.totalDueMinor, currency: q.currency, ref: result.ref, note: result.message || '' });
  if (result.status !== 'approved') { s.status = result.status; return { order: null, status: result.status }; }
  const err = validateContact(contact);
  if (Object.keys(err).length) throw new Error('Receipt contact is incomplete.');
  const order = { id: nextId(platform, 'ord'), kind: 'new', persona: ws.persona, createdAt: now, catalogVersion: platform.catalog.version, sessionId: s.id, paymentRef: result.ref,
    contact: { name: contact.name.trim(), email: contact.email.trim(), company: (contact.company || '').trim() },
    cadence: q.cadence, currency: q.currency, lines: clone(q.lines), monthlyListMinor: q.monthlyListMinor, monthlyNetMinor: q.monthlyNetMinor, bundleSavingMinor: q.bundleSavingMinor,
    smaBps: q.smaBps, smaMonthlyMinor: q.smaMonthlyMinor, recurringMonthlyMinor: q.recurringMonthlyMinor, oneTimeMinor: q.oneTimeMinor, usageTerms: clone(q.usageTerms),
    cadenceDiscountMinor: q.cadenceDiscountMinor, subtotalMinor: q.subtotalMinor, taxBps: q.taxBps, taxMinor: q.taxMinor, totalDueMinor: q.totalDueMinor, renewsAt: addMonths(now, q.months), status: 'paid (simulated)' };
  applyOrder(ws, order, now);
  platform.orders.unshift(order);
  ws.onboarding.unlocked = true;
  s.orderId = order.id; s.status = 'paid';
  draft.lastOrderId = order.id; draft.cart = { ...emptyCart(), cadence: draft.cart.cadence };
  log(ws, 'Purchase completed (simulated payment)', `${order.id}: ${order.lines.map((l) => l.skuName).join(', ')}`, now);
  return { order, status: 'approved' };
}

/** What "buy more" applies to: a per-seat product (incl. platform user licences) or a bundle seat pool ("pool:<SKU>"). */
export function seatTarget(ws, id) {
  if (String(id).startsWith('pool:')) {
    const pool = ws.pools?.[id.slice(5)];
    if (!pool) throw new Error('Bundle seat pool not found.');
    return { id, pool, name: `${pool.name} bundle seats`, purchased: pool.purchased, noun: 'bundle seats' };
  }
  const e = ws.entitlements[id];
  if (!e) throw new Error('Module not purchased.');
  if (e.licenseMetric !== 'per_seat') throw new Error(`${e.productName} is licensed ${e.metricLabel.toLowerCase()}; there are no seats to add.`);
  return { id, entitlement: e, name: e.productName, purchased: e.purchased, noun: e.kind === 'platform' ? 'user licences' : 'seats' };
}
/** Price preview for extra seats (one product at the same tier, or one bundle pool), with illustrative proration to the current term end. */
export function previewAddSeats(cat, ws, targetId, seats, now = clock.now()) {
  const t = seatTarget(ws, targetId);
  if (!Number.isInteger(seats) || seats < 1 || seats > 500) throw new Error('Enter a whole number of seats between 1 and 500.');
  let s, line;
  if (t.pool) {
    s = offersFor(cat, ws.persona, 'bundle').find((x) => x.id === t.pool.poolId && metricsOf(x).includes('bundle_seat'));
    if (!s) throw new Error(`${t.pool.name} bundle seats are not currently sold. Send a plan-change request instead.`);
    line = { skuId: s.id, metric: 'bundle_seat', bundleSeats: seats };
  } else {
    const e = t.entitlement;
    s = offersFor(cat, ws.persona, 'standalone').find((x) => x.components[0].productId === e.productId && x.components[0].tierId === e.tierId && metricsOf(x).includes('per_seat'));
    if (!s) throw new Error(`${e.productName} ${e.tierName} seats are not currently sold standalone. Send a plan-change request instead.`);
    line = { skuId: s.id, metric: 'per_seat', seats: { [e.productId]: seats } };
  }
  const sub = ws.subscriptions[0];
  const q = quote(cat, { lines: [line], cadence: sub.cadence }, heldCtx(ws));
  if (q.errors.length) throw new Error(q.errors[0]);
  const termDays = Math.max(1, Math.round((new Date(sub.renewsAt) - new Date(sub.startedAt)) / DAY));
  const daysLeft = Math.min(termDays, Math.max(1, Math.ceil((new Date(sub.renewsAt) - new Date(now)) / DAY)));
  const proratedMinor = Math.round((q.subtotalMinor * daysLeft) / termDays);
  const taxMinor = pctBps(proratedMinor, q.taxBps);
  return { sku: s, target: t, quote: q, seats, productId: targetId, termDays, daysLeft, proratedMinor, taxMinor, dueNowMinor: proratedMinor + taxMinor, renewsAt: sub.renewsAt };
}
/** Capacity changes only after an approved (simulated) payment. One session → at most one order. */
export function completeAddSeats({ platform, ws, session, result, now = clock.now() }) {
  if (session.orderId) return { order: platform.orders.find((o) => o.id === session.orderId), duplicate: true };
  const p = previewAddSeats(platform.catalog.published, ws, session.productId, session.seats, now);
  platform.billingEvents.unshift({ id: nextId(platform, 'evt'), at: now, type: `payment_${result.status}`, sessionId: session.id, persona: ws.persona, amountMinor: p.dueNowMinor, currency: p.quote.currency, ref: result.ref, note: 'Add seats' });
  if (result.status !== 'approved') { session.status = result.status; return { order: null, status: result.status }; }
  const order = { id: nextId(platform, 'ord'), kind: 'add_seats', persona: ws.persona, createdAt: now, catalogVersion: platform.catalog.version, sessionId: session.id, paymentRef: result.ref,
    contact: platform.orders.find((o) => o.id === ws.orders[0])?.contact || {}, cadence: p.quote.cadence, currency: p.quote.currency, lines: clone(p.quote.lines),
    monthlyListMinor: p.quote.monthlyListMinor, monthlyNetMinor: p.quote.monthlyNetMinor, bundleSavingMinor: 0, cadenceDiscountMinor: p.quote.cadenceDiscountMinor,
    smaBps: p.quote.smaBps, smaMonthlyMinor: p.quote.smaMonthlyMinor, recurringMonthlyMinor: p.quote.recurringMonthlyMinor, oneTimeMinor: 0, usageTerms: [],
    subtotalMinor: p.proratedMinor, taxBps: p.quote.taxBps, taxMinor: p.taxMinor, totalDueMinor: p.dueNowMinor, renewsAt: p.renewsAt, status: 'paid (simulated)', note: `Illustrative proration: ${p.daysLeft} of ${p.termDays} days` };
  applyOrder(ws, order, now);
  platform.orders.unshift(order);
  session.orderId = order.id; session.status = 'paid';
  log(ws, 'Seats purchased (simulated payment)', `${order.id}: +${session.seats} ${p.target.name}`, now);
  return { order, status: 'approved' };
}
/** Explicit, confirmed billing operation. Never below occupied + reserved seats. */
export function reduceSeats({ platform, ws, productId, newCount, occupied, now = clock.now() }) {
  const t = seatTarget(ws, productId);
  if (!Number.isInteger(newCount) || newCount < 0) throw new Error('Enter a whole number.');
  if (newCount >= t.purchased) throw new Error(`Enter a number lower than the current purchased ${t.noun}.`);
  if (newCount < occupied) throw new Error(`${occupied} ${t.name} ${t.pool ? '' : 'seats '}are assigned or reserved. Remove access first, then reduce.`);
  const from = t.purchased;
  if (t.pool) t.pool.purchased = newCount; else t.entitlement.purchased = newCount;
  platform.billingEvents.unshift({ id: nextId(platform, 'evt'), at: now, type: 'seat_reduction', persona: ws.persona, amountMinor: 0, currency: 'USD', ref: '', note: `${t.name} ${from} → ${newCount}; lower charge from next renewal (demo policy)` });
  log(ws, 'Purchased seats reduced', `${t.name}: ${from} → ${newCount}. Billing changes at next renewal (demo policy).`, now);
}

/** Simulated usage for a usage-metered add-on (production: events from the module, aggregated by a meter). */
export function recordUsage(ws, productId, units, now = clock.now()) {
  const e = ws.entitlements[productId];
  if (!e?.usage) throw new Error('This product is not licensed per usage.');
  if (!Number.isInteger(units) || units < 1 || units > 100000) throw new Error('Enter a whole number of units.');
  e.usage.used += units;
  log(ws, 'Usage recorded (simulated)', `${e.productName}: +${units} ${e.usage.unitLabel}${units === 1 ? '' : 's'}`, now);
}
/** Estimated charge for usage so far this period: units beyond the included allowance × rate. */
export function usageEstimate(u) {
  const billable = Math.max(0, (u.used || 0) - u.includedUnits);
  return { billable, amountMinor: billable * u.rateMinor };
}
/** Demo: move a setup service through its delivery states. */
export const SERVICE_STATUS = { to_schedule: 'To be scheduled', scheduled: 'Scheduled', completed: 'Completed' };
export function advanceService(ws, id, now = clock.now()) {
  const sv = (ws.services || []).find((x) => x.id === id);
  if (!sv) throw new Error('Service not found.');
  const next = { to_schedule: 'scheduled', scheduled: 'completed' }[sv.status];
  if (!next) throw new Error('This service is already completed.');
  sv.status = next; log(ws, `Setup service ${SERVICE_STATUS[next].toLowerCase()} (demo)`, sv.skuName, now);
}
