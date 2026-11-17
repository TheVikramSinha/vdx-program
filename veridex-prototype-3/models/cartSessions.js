// Cart sessions: the buyer's contact is captured before they browse, and each cart is tracked so staff can follow up on abandoned carts.
// A cart session belongs to the platform (VeriDex sales), never to a customer workspace. It holds the purchaser's own contact only — no team roster.
import { nextId, clock } from './ids.js';
import { quote } from './pricing.js';
import { CADENCES } from './pricing.js';

export const FOLLOW_UP_STATUS = { new: 'New', contacted: 'Contacted', recovered: 'Recovered', closed: 'Closed', do_not_contact: 'Do not contact' };
export const STAGES = { browsing: 'Browsing', shop: 'Choosing products', review: 'Reviewing order', checkout: 'At checkout', payment_failed: 'Payment failed', converted: 'Purchased' };
export const ABANDON_OPTIONS = [[0, 'Immediately (demo)'], [30, 'After 30 minutes'], [60, 'After 1 hour'], [1440, 'After 24 hours']];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateStartContact(c = {}) {
  const e = {};
  if (!(c.name || '').trim()) e['start-name'] = 'Enter your name.';
  if (!EMAIL.test((c.email || '').trim())) e['start-email'] = 'Enter a valid work email, e.g. name@company.com.';
  if (!(c.company || '').trim()) e['start-company'] = 'Enter your company name.';
  if ((c.phone || '').trim() && !/^[+()\d\s.-]{7,20}$/.test(c.phone.trim())) e['start-phone'] = 'Enter a phone number with 7–20 digits, or leave it empty.';
  return e;
}
export const hasContact = (draft) => !!draft.contact?.capturedAt;
const session = (platform, draft) => draft.sessionId && platform.cartSessions.find((x) => x.id === draft.sessionId);

/** Capture (or update) the buyer's contact and open their cart session. Must happen before products can be selected. */
export function startSession(platform, draft, input, now = clock.now()) {
  const e = validateStartContact(input);
  if (Object.keys(e).length) throw Object.assign(new Error(Object.values(e)[0]), { fields: e });
  const contact = { name: input.name.trim(), email: input.email.trim(), company: input.company.trim(), phone: (input.phone || '').trim(), jobTitle: (input.jobTitle || '').trim(),
    followUpConsent: !!input.followUpConsent, consentAt: input.followUpConsent ? now : null, capturedAt: draft.contact?.capturedAt || now };
  draft.contact = contact;
  let s = session(platform, draft);
  if (!s || s.orderId) {
    s = { id: nextId(platform, 'cart'), persona: draft.persona, contact: { ...contact }, startedAt: now, lastActivityAt: now, stage: 'browsing', lines: [], recurringMonthlyMinor: 0, oneTimeMinor: 0, dueTodayMinor: 0,
      cadence: draft.cart.cadence, orderId: null, followUp: { status: contact.followUpConsent ? 'new' : 'do_not_contact', owner: 'Unassigned', notes: [] }, events: [{ at: now, text: 'Contact details captured' }] };
    platform.cartSessions.unshift(s);
    draft.sessionId = s.id;
  } else {
    const wasConsent = s.contact.followUpConsent;
    s.contact = { ...contact }; s.lastActivityAt = now;
    s.events.push({ at: now, text: 'Contact details updated' });
    if (wasConsent && !contact.followUpConsent) { s.followUp.status = 'do_not_contact'; s.events.push({ at: now, text: 'Follow-up permission withdrawn' }); }
    if (!wasConsent && contact.followUpConsent && s.followUp.status === 'do_not_contact') s.followUp.status = 'new';
  }
  return s;
}
/** Keep the cart session in step with the cart: contents, value, stage and last activity. */
export function touchSession(platform, draft, cat, stage, ctx, now = clock.now()) {
  const s = session(platform, draft);
  if (!s || s.orderId) return;
  const q = quote(cat, draft.cart, ctx);
  const lines = q.lines.map((l) => ({ skuId: l.skuId, skuName: l.skuName, detail: l.usage ? `usage, ${l.usage.includedUnits} ${l.usage.unitLabel}s included` : l.units != null ? `${l.units} ${l.unitLabel}${l.units === 1 ? '' : 's'}` : l.components.map((c) => `${c.seats} ${c.productName}`).join(' + ') }));
  const changed = JSON.stringify(lines) !== JSON.stringify(s.lines) || s.cadence !== q.cadence;
  if (stage && stage !== s.stage) s.events.push({ at: now, text: `Stage: ${STAGES[stage]}` });
  if (changed) s.events.push({ at: now, text: lines.length ? `Cart: ${lines.map((l) => l.skuName).join(', ')} (${CADENCES[q.cadence].label.toLowerCase()})` : 'Cart emptied' });
  if (s.events.length > 60) s.events.splice(1, s.events.length - 60);
  Object.assign(s, { lines, cadence: q.cadence, recurringMonthlyMinor: q.recurringMonthlyMinor, oneTimeMinor: q.oneTimeMinor, dueTodayMinor: q.totalDueMinor, lastActivityAt: now });
  if (stage) s.stage = stage;
}
export function markConverted(platform, draft, orderId, now = clock.now()) {
  const s = session(platform, draft);
  if (!s) return;
  Object.assign(s, { orderId, stage: 'converted', lastActivityAt: now }); s.events.push({ at: now, text: `Purchased: order ${orderId}` });
  if (s.followUp.status === 'contacted') s.followUp.status = 'recovered';
  draft.sessionId = null; // a new purchase from the same buyer starts a new cart session
}
export function markPaymentFailed(platform, draft, status, now = clock.now()) {
  const s = session(platform, draft);
  if (!s) return;
  s.stage = 'payment_failed'; s.lastActivityAt = now; s.events.push({ at: now, text: `Payment ${status} (simulated)` });
}
/** converted → purchased; otherwise abandoned once idle for the threshold; else active. */
export function sessionStatus(s, abandonAfterMinutes, now = clock.now()) {
  if (s.orderId) return 'converted';
  return (new Date(now) - new Date(s.lastActivityAt)) / 60000 >= abandonAfterMinutes ? 'abandoned' : 'active';
}
export function updateFollowUp(platform, id, patch, now = clock.now()) {
  const s = platform.cartSessions.find((x) => x.id === id);
  if (!s) throw new Error('Cart not found.');
  if (patch.status && FOLLOW_UP_STATUS[patch.status]) {
    if (!s.contact.followUpConsent && ['contacted'].includes(patch.status)) throw new Error('This buyer did not give follow-up permission. Do not contact them about this cart.');
    s.followUp.status = patch.status;
  }
  if (patch.owner) s.followUp.owner = patch.owner;
  if (patch.note?.trim()) s.followUp.notes.unshift({ at: now, text: patch.note.trim().slice(0, 500) });
}
export function cartBrief(s, status, money) {
  return [`VeriDex cart follow-up brief (demo) — ${s.id}`, `Status: ${status}. Nothing has been sent to this buyer.`, '',
    `Name: ${s.contact.name}`, `Company: ${s.contact.company}`, `Email: ${s.contact.email}`, s.contact.phone ? `Phone: ${s.contact.phone}` : '', s.contact.jobTitle ? `Job title: ${s.contact.jobTitle}` : '',
    `Follow-up permission: ${s.contact.followUpConsent ? `given ${s.contact.consentAt}` : 'NOT given — do not contact about this cart'}`, '',
    `Journey: ${s.persona}`, `Started: ${s.startedAt}`, `Last activity: ${s.lastActivityAt}`, `Furthest stage: ${STAGES[s.stage]}`,
    `Cart (${s.cadence}):`, ...(s.lines.length ? s.lines.map((l) => `  ${l.skuId}  ${l.skuName} — ${l.detail}`) : ['  (empty)']),
    `Recurring per month incl. SMA: ${money(s.recurringMonthlyMinor)}`, `One-time services: ${money(s.oneTimeMinor)}`, `Due today if bought: ${money(s.dueTodayMinor)}`].filter((x) => x !== '').join('\n');
}
