// Storefront controller for both sales journeys. The persona comes from the page (index.html = tenant, carrier.html = carrier).
import { personaFromPage, loadState, mount, toast } from './base.js';
import { shop, review, checkout, confirmation } from '../views/templates/storefront.js';
import { personaOf } from '../data/personas.js';
import { quote, setLine, removeLine, setCadence, compareDemand, CADENCES } from '../models/pricing.js';
import { sku as getSku, isFixed } from '../models/catalog.js';
import { toQty, fmt } from '../models/money.js';
import { openCheckout, recordPayment, validateContact } from '../models/orders.js';
import { reviewChecklist, reviewGate, confirmReview, cartKey } from '../models/checkoutChecklist.js';
import { capacity } from '../models/licensing.js';
import { authorize } from '../services/paymentMock.js';
import { download } from '../services/crmMock.js';
import { initChat } from './chat.js';

const pid = personaFromPage();
const persona = personaOf(pid);
const S = loadState(pid);
const local = { errors: {}, pay: { busy: false, status: null, message: '', attempts: 0 }, showGateErrors: false };
const cat = () => S.platform.catalog.published;
const ui = () => S.draft.ui;
const route = () => (['shop', 'review', 'checkout', 'confirmation'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'shop');

function existingConflicts(q) {
  return q.capacity.filter((c) => S.ws.entitlements[c.productId] && !c.tiers[S.ws.entitlements[c.productId].tierId])
    .map((c) => `${c.productName}: your workspace already runs ${S.ws.entitlements[c.productId].tierName}. A different tier needs a plan-change request in Tenant Admin, not a new order.`);
}
function vm() {
  const q = quote(cat(), S.draft.cart);
  const demand = Object.fromEntries(Object.entries(ui().demand).filter(([, n]) => n > 0));
  const options = compareDemand(cat(), pid, demand);
  const renews = new Date(); renews.setMonth(renews.getMonth() + CADENCES[q.cadence].months);
  return { persona, cat: cat(), draft: S.draft, ui: ui(), q, options, cheapest: options.reduce((b, o, i) => (o.monthlyMinor < options[b].monthlyMinor ? i : b), 0),
    inCart: Object.fromEntries(S.draft.cart.lines.map((l) => [l.skuId, l])), existing: existingConflicts(q), hasSubscription: S.ws.subscriptions.length > 0,
    checklist: reviewChecklist(S.draft), gate: reviewGate(S.draft), renewsAt: renews.toISOString(), ...local,
    order: S.platform.orders.find((o) => o.id === S.draft.lastOrderId), capacity: capacity(S.ws) };
}
function view() {
  const r = route(), v = vm();
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
  if (isFixed(s)) return { packages: saved.packages ?? line?.packages ?? 1 };
  return { seats: Object.fromEntries(s.components.map((c) => [c.productId, saved[c.productId] ?? line?.seats?.[c.productId] ?? s.quantityRule.min])) };
}
const commit = () => { S.save(); app.refresh(); chat.repaint(); };

const app = mount({ page: pid === 'carrier' ? 'carrier' : 'shop', persona: pid, view, handlers: {
  noop: () => toast('Add something purchasable and resolve any conflicts first.', 'error'),
  tab: (el) => { ui().tab = el.dataset.id; commit(); },
  tier: (el) => { ui().tier[el.dataset.pid] = el.value; commit(); },
  qty: (el) => {
    const n = toQty(el.value), s = getSku(cat(), el.dataset.sku), { min, max } = s.quantityRule;
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
    S.draft.cart.lines = []; ui().qty = {};
    for (const l of o.lines) { const r = setLine(S.draft.cart, cat(), l.skuId, l); if (!r.ok) return toast(r.error, 'error'); }
    commit(); toast(`Order set to: ${o.name}.`);
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
    openCheckout(S.draft, cat()); S.save(); location.hash = 'checkout';
  },
  contact: (el) => { S.draft.contact[el.id] = el.value; S.save(); },
  method: (el) => { ui().method = el.value; S.save(); },
  pay: async (formEl) => {
    if (local.pay.busy) return;
    for (const k of ['name', 'email', 'company']) S.draft.contact[k] = formEl.elements[k].value;
    local.errors = validateContact(S.draft.contact);
    if (Object.keys(local.errors).length) { commit(); document.getElementById('error-summary')?.focus(); return; }
    const session = openCheckout(S.draft, cat()), q = quote(cat(), S.draft.cart);
    local.pay = { ...local.pay, busy: true, status: null }; commit();
    const result = await authorize({ method: ui().method, amountMinor: q.totalDueMinor, currency: q.currency, idempotencyKey: session.id });
    const out = recordPayment({ platform: S.platform, ws: S.ws, draft: S.draft, result, contact: S.draft.contact });
    local.pay = { busy: false, status: result.status, message: result.message, attempts: S.draft.checkout.attempts.length };
    if (out.order) S.draft.confirmations = {};
    S.save();
    if (out.order) location.hash = 'confirmation'; else { app.refresh(); document.querySelector('.alert')?.scrollIntoView({ block: 'center' }); }
  },
  receipt: () => {
    const o = S.platform.orders.find((x) => x.id === S.draft.lastOrderId);
    download(`veridex-receipt-${o.id}.txt`, [`VeriDex receipt (DEMO — simulated payment, not a tax document)`, `Order ${o.id} · ${o.createdAt} · reference ${o.paymentRef}`, `Billed to: ${o.contact.name}${o.contact.company ? ', ' + o.contact.company : ''} <${o.contact.email}>`, '',
      ...o.lines.flatMap((l) => [`${l.skuId}  ${l.skuName}  ${fmt(l.monthlyNetMinor)}/month`, ...l.components.map((c) => `    ${c.seats} x ${c.productName} ${c.tierName}`)]), '',
      `Cadence: ${o.cadence}`, `Subtotal: ${fmt(o.subtotalMinor)}`, `Estimated tax: ${fmt(o.taxMinor)}`, `Paid: ${fmt(o.totalDueMinor)} ${o.currency}`, `Renews: ${o.renewsAt}`].join('\n'));
  },
  'open-chat': () => chat.open(),
} });
const chat = initChat(S, () => ({ persona: persona.short, step: route(), products: [...new Set(quote(cat(), S.draft.cart).capacity.map((c) => c.productName))] }));
window.addEventListener('hashchange', () => { app.refresh(); window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); });
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
