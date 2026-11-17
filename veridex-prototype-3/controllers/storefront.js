// Storefront controller for both sales journeys. The persona comes from the page (index.html = tenant, carrier.html = carrier).
import { personaFromPage, loadState, mount, toast } from './base.js';
import { shop, review, checkout, confirmation, start, lineDetail } from '../views/templates/storefront.js';
import { personaOf } from '../data/personas.js';
import { quote, setLine, removeLine, setCadence, compareDemand, CADENCES } from '../models/pricing.js';
import { sku as getSku, isFixed } from '../models/catalog.js';
import { toQty, fmt } from '../models/money.js';
import { openCheckout, recordPayment, validateContact, heldCtx } from '../models/orders.js';
import { startSession, touchSession, markConverted, markPaymentFailed, hasContact } from '../models/cartSessions.js';
import { bpsLabel } from '../models/money.js';
import { reviewChecklist, reviewGate, confirmReview, cartKey } from '../models/checkoutChecklist.js';
import { capacity, userLicences } from '../models/licensing.js';
import { authorize } from '../services/paymentMock.js';
import { download } from '../services/crmMock.js';
import { initChat } from './chat.js';

const pid = personaFromPage();
const persona = personaOf(pid);
const S = loadState(pid);
const local = { errors: {}, startErrors: {}, pay: { busy: false, status: null, message: '', attempts: 0 }, showGateErrors: false };
const cat = () => S.platform.catalog.published;
const ui = () => S.draft.ui;
const ROUTES = ['start', 'shop', 'review', 'checkout', 'confirmation'];
const route = () => { const r = ROUTES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'shop'; return r !== 'confirmation' && !hasContact(S.draft) ? 'start' : r; };
const ctx = () => heldCtx(S.ws);

function existingConflicts(q) {
  return q.capacity.filter((c) => S.ws.entitlements[c.productId] && !c.tiers[S.ws.entitlements[c.productId].tierId])
    .map((c) => `${c.productName}: your workspace already runs ${S.ws.entitlements[c.productId].tierName}. A different tier needs a plan-change request in Tenant Admin, not a new order.`);
}
function vm() {
  const q = quote(cat(), S.draft.cart, ctx());
  const demand = Object.fromEntries(Object.entries(ui().demand).filter(([, n]) => n > 0));
  const options = compareDemand(cat(), pid, demand);
  const renews = new Date(); renews.setMonth(renews.getMonth() + CADENCES[q.cadence].months);
  return { persona, cat: cat(), draft: S.draft, ui: ui(), q, options, cheapest: options.reduce((b, o, i) => (o.monthlyMinor < options[b].monthlyMinor ? i : b), 0),
    inCart: Object.fromEntries(S.draft.cart.lines.map((l) => [l.skuId, l])), existing: existingConflicts(q), hasSubscription: S.ws.subscriptions.length > 0,
    checklist: reviewChecklist(S.draft), gate: reviewGate(S.draft), renewsAt: renews.toISOString(), ...local,
    order: S.platform.orders.find((o) => o.id === S.draft.lastOrderId), capacity: capacity(S.ws), held: S.ws.entitlements, heldUsers: userLicences(S.ws)?.purchased || 0 };
}
function view() {
  const r = route(), v = vm();
  if (r === 'start') return start({ ...v, errors: local.startErrors });
  if (r === 'review') return review(v);
  if (r === 'checkout') {
    if (!v.q.purchasable || v.existing.length || !v.gate.ok) { location.replace('#review'); return review(v); }
    return checkout(v);
  }
  if (r === 'confirmation') return confirmation(v);
  return shop(v);
}
function qtyFor(s) {
  const saved = ui().qty[s.id] || {}, line = S.draft.cart.lines.find((l) => l.skuId === s.id);
  if (s.quantityRule.type === 'usage') return {};
  if (s.quantityRule.type === 'flat') return { units: saved.units ?? line?.units ?? s.quantityRule.min };
  if (isFixed(s)) return { packages: saved.packages ?? line?.packages ?? 1 };
  return { seats: Object.fromEntries(s.components.map((c) => [c.productId, saved[c.productId] ?? line?.seats?.[c.productId] ?? (c.productId === 'mod_core' ? defaultUsers() : s.quantityRule.min)])) };
}
const defaultUsers = () => Math.max(1, ...Object.values(ui().demand).filter(Number.isInteger));
/** Every change to the cart updates the buyer's cart session (for abandoned-cart follow-up). */
const track = () => { const r = route(); if (r !== 'start' && r !== 'confirmation') touchSession(S.platform, S.draft, cat(), r, ctx()); };
const commit = () => { track(); S.save(); app.refresh(); chat.repaint(); };
const syncSessionContact = () => { const sess = S.platform.cartSessions.find((x) => x.id === S.draft.sessionId); if (sess) Object.assign(sess.contact, { name: S.draft.contact.name, email: S.draft.contact.email, company: S.draft.contact.company }); };

const app = mount({ page: pid === 'carrier' ? 'carrier' : 'shop', persona: pid, view, handlers: {
  noop: () => toast('Add something purchasable and resolve any conflicts first.', 'error'),
  tab: (el) => { ui().tab = el.dataset.id; commit(); },
  tier: (el) => { ui().tier[el.dataset.pid] = el.value; commit(); },
  'start-contact': (f) => {
    const input = { name: f.elements['start-name'].value, email: f.elements['start-email'].value, company: f.elements['start-company'].value, phone: f.elements['start-phone'].value,
      jobTitle: f.elements['start-title'].value, followUpConsent: f.elements['start-consent'].checked };
    try { startSession(S.platform, S.draft, input); } catch (err) { local.startErrors = err.fields || {}; S.draft.contact = { ...S.draft.contact, ...input, capturedAt: S.draft.contact.capturedAt }; app.refresh(); document.getElementById('error-summary')?.focus(); return; }
    local.startErrors = {}; S.save(); location.hash = 'shop'; toast(`Thanks, ${input.name.trim().split(' ')[0]}. Your cart is saved as you go.`);
  },
  qty: (el) => {
    const n = toQty(el.value), s = getSku(cat(), el.dataset.sku), min = s.quantityRule.min, max = s.quantityRule.max;
    if (n == null || n < min || n > max) { toast(`Enter a whole number between ${min} and ${max}.`, 'error'); app.refresh(); return; }
    (ui().qty[s.id] ||= {})[el.dataset.pid] = n; commit();
  },
  step: (el) => { const input = document.getElementById(el.dataset.id); const n = (toQty(input.value) ?? 0) + Number(el.dataset.arg); input.value = Math.max(Number(input.min), Math.min(Number(input.max), n)); input.dispatchEvent(new Event('change', { bubbles: true })); },
  add: (el) => {
    const s = getSku(cat(), el.dataset.id);
    const r = setLine(S.draft.cart, cat(), s.id, qtyFor(s));
    if (!r.ok) return toast(r.error, 'error');
    commit(); toast(`${s.name} ${r.replaced ? 'updated in' : 'added to'} your order.`);
  },
  remove: (el) => { removeLine(S.draft.cart, el.dataset.id); delete ui().qty[el.dataset.id]; commit(); },
  cadence: (el) => { setCadence(S.draft.cart, el.value); commit(); },
  demand: (el) => { const n = el.value === '' ? 0 : toQty(el.value); if (n == null || n > 500) { toast('Enter a whole number from 0 to 500.', 'error'); app.refresh(); return; } ui().demand[el.dataset.pid] = n; commit(); },
  example: () => { ui().demand = { mod_claims: 10, mod_legal: 4 }; commit(); },
  'use-option': (el) => {
    const o = vm().options[+el.dataset.id];
    // Replace module/bundle lines only; keep user licences, add-ons and services the buyer already chose.
    const keep = S.draft.cart.lines.filter((l) => { const k = getSku(cat(), l.skuId); return k && !['per_module'].includes(k.licenseMetric || 'per_module'); });
    S.draft.cart.lines = keep; ui().qty = {};
    for (const l of o.lines) { const r = setLine(S.draft.cart, cat(), l.skuId, l); if (!r.ok) return toast(r.error, 'error'); }
    const core = cat().skus.find((k) => k.status === 'published' && k.licenseMetric === 'per_user' && k.audience.includes(pid));
    let added = '';
    if (cat().settings.requirePlatformLicence && core && !userLicences(S.ws) && !S.draft.cart.lines.some((l) => l.skuId === core.id)) {
      const n = Math.max(...o.parts.map((p) => p.seats)); setLine(S.draft.cart, cat(), core.id, { seats: { [core.components[0].productId]: n } }); added = ` Added ${n} VeriDex Core user licences — change on “Modules & users”.`;
    }
    commit(); toast(`Order set to: ${o.name}.${added}`);
  },
  'check-toggle': (el) => { confirmReview(S.draft, el.dataset.id, el.checked); commit(); },
  'save-quote': () => {
    const q = quote(cat(), S.draft.cart), key = cartKey(S.draft);
    if (!S.draft.savedQuotes.some((x) => x.key === key)) S.draft.savedQuotes.push({ key, at: new Date().toISOString(), totalDueMinor: q.totalDueMinor });
    download('veridex-quote.json', JSON.stringify({ note: 'Illustrative VeriDex quote (demo). Not an offer.', journey: pid, catalogVersion: S.platform.catalog.version, quote: q }, null, 2), 'application/json');
    commit(); toast('Quote saved and downloaded.');
  },
  'to-checkout': () => {
    if (!reviewGate(S.draft).ok) { local.showGateErrors = true; app.refresh(); document.getElementById('error-summary')?.focus(); return; }
    local.showGateErrors = false; local.errors = {}; local.pay = { busy: false, status: null, message: '', attempts: S.draft.checkout?.attempts.length || 0 };
    openCheckout(S.draft, cat(), S.ws); S.save(); location.hash = 'checkout';
  },
  contact: (el) => { S.draft.contact[el.id] = el.value; syncSessionContact(); S.save(); },
  method: (el) => { ui().method = el.value; S.save(); },
  pay: async (formEl) => {
    if (local.pay.busy) return;
    for (const k of ['name', 'email', 'company']) S.draft.contact[k] = formEl.elements[k].value;
    local.errors = validateContact(S.draft.contact);
    if (Object.keys(local.errors).length) { commit(); document.getElementById('error-summary')?.focus(); return; }
    syncSessionContact();
    const session = openCheckout(S.draft, cat(), S.ws), q = quote(cat(), S.draft.cart, ctx());
    local.pay = { ...local.pay, busy: true, status: null }; commit();
    const result = await authorize({ method: ui().method, amountMinor: q.totalDueMinor, currency: q.currency, idempotencyKey: session.id });
    const out = recordPayment({ platform: S.platform, ws: S.ws, draft: S.draft, result, contact: S.draft.contact });
    local.pay = { busy: false, status: result.status, message: result.message, attempts: S.draft.checkout.attempts.length };
    if (out.order) { S.draft.confirmations = {}; markConverted(S.platform, S.draft, out.order.id); } else markPaymentFailed(S.platform, S.draft, result.status);
    S.save();
    if (out.order) location.hash = 'confirmation'; else { app.refresh(); document.querySelector('.alert')?.scrollIntoView({ block: 'center' }); }
  },
  receipt: () => {
    const o = S.platform.orders.find((x) => x.id === S.draft.lastOrderId);
    download(`veridex-receipt-${o.id}.txt`, [`VeriDex receipt (DEMO — simulated payment, not a tax document)`, `Order ${o.id} · ${o.createdAt} · reference ${o.paymentRef}`, `Billed to: ${o.contact.name}${o.contact.company ? ', ' + o.contact.company : ''} <${o.contact.email}>`, '',
      ...o.lines.map((l) => `${l.skuId}  ${l.skuName}  [${l.chargeType === 'one_time' ? 'one-time' : l.licenseMetric}]  ${l.usage ? 'billed on use' : l.chargeType === 'one_time' ? fmt(l.oneTimeMinor) + ' once' : fmt(l.monthlyNetMinor) + '/month'}\n    ${lineDetail(l)}`), '',
      `Licence fees: ${fmt(o.monthlyNetMinor)}/month`, `Hosted access & support (SMA ${bpsLabel(o.smaBps || 0)}): ${fmt(o.smaMonthlyMinor || 0)}/month`, `Cadence: ${o.cadence}`,
      o.oneTimeMinor ? `One-time setup: ${fmt(o.oneTimeMinor)}` : '', `Subtotal: ${fmt(o.subtotalMinor)}`, `Estimated tax: ${fmt(o.taxMinor)}`, `Paid: ${fmt(o.totalDueMinor)} ${o.currency}`, `Renews: ${o.renewsAt}`,
      ...(o.usageTerms || []).map((u) => `Usage: ${u.skuName} ${fmt(u.rateMinor)} per ${u.unitLabel} after ${u.includedUnits} included, billed monthly in arrears`)].filter((x) => x !== '').join('\n'));
  },
  'open-chat': () => chat.open(),
} });
const chat = initChat(S, () => ({ persona: persona.short, step: route(), products: [...new Set(quote(cat(), S.draft.cart, ctx()).lines.map((l) => l.skuName))] }));
window.addEventListener('hashchange', () => { track(); S.save(); app.refresh(); window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); });
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
