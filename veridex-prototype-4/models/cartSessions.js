// Cart sessions: the buyer's contact is captured before they browse, and each cart is tracked so staff can follow up on abandoned carts.
// A cart session belongs to the platform (VeriDex sales), never to a customer workspace. It holds the purchaser's own contact only — no team roster.
import { nextId, clock } from './ids.js';
import { quote } from './pricing.js';
import { CADENCES } from './pricing.js';

export const FOLLOW_UP_STATUS = { new: 'New', contacted: 'Contacted', recovered: 'Recovered', closed: 'Closed', do_not_contact: 'Do not contact' };
export const STAGES = { browsing: 'Browsing', shop: 'Choosing products', review: 'Reviewing order', checkout: 'At checkout', payment_failed: 'Payment failed', converted: 'Purchased' };
export const ABANDON_OPTIONS = [[0, 'Immediately (demo)'], [30, 'After 30 minutes'], [60, 'After 1 hour'], [1440, 'After 24 hours']];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lead capture (before any product can be chosen): contact, business and requirements. Purchaser and company only — never the team roster. */
export const ROLES_IN_DECISION = { decision_maker: 'Decision maker', influencer: 'Recommends / influences', evaluator: 'Evaluating options', other: 'Other', not_sure: 'Not sure' };
export const REGIONS = ['US — Northeast', 'US — Southeast', 'US — Midwest', 'US — Southwest', 'US — West', 'US — nationwide', 'Canada', 'Other'];
export const BUDGETS = { under_1k: 'Under $1,000 / month', '1k_5k': '$1,000–$5,000 / month', '5k_20k': '$5,000–$20,000 / month', over_20k: 'Over $20,000 / month', not_sure: 'Not sure / prefer not to say' };
export const TIMELINES = { this_month: 'This month', this_quarter: 'This quarter', six_months: 'Within 6 months', exploring: 'Just exploring', not_sure: 'Not sure' };
export const HEARD = ['Search', 'Referral or colleague', 'Event or webinar', 'Partner or carrier', 'Existing customer', 'Other'];
const s_ = (v, n) => String(v ?? '').trim().slice(0, n);
export function normaliseLead(i = {}) {
  const users = String(i.estUsers ?? '').trim();
  return { name: s_(i.name, 120), email: s_(i.email, 160), phone: s_(i.phone, 30), jobTitle: s_(i.jobTitle, 120), decisionRole: s_(i.decisionRole, 30) || 'not_sure',
    company: s_(i.company, 160), industry: s_(i.industry, 80), companySize: s_(i.companySize, 40), region: s_(i.region, 40), website: s_(i.website, 200), currentSystem: s_(i.currentSystem, 160),
    useCase: s_(i.useCase, 120), interests: (i.interests || []).map((x) => s_(x, 60)).slice(0, 20), estUsers: users === '' ? null : /^\d{1,5}$/.test(users) ? Number(users) : NaN,
    budget: s_(i.budget, 20) || 'not_sure', timeline: s_(i.timeline, 20), notes: s_(i.notes, 1000), heardFrom: s_(i.heardFrom, 60), followUpConsent: !!i.followUpConsent };
}
export function validateStartContact(input = {}) {
  const c = normaliseLead(input), e = {};
  if (!c.name) e['start-name'] = 'Enter your name.';
  if (!EMAIL.test(c.email)) e['start-email'] = 'Enter a valid work email, e.g. name@company.com.';
  if (c.phone && !/^[+()\d\s.-]{7,20}$/.test(c.phone)) e['start-phone'] = 'Enter a phone number with 7–20 digits, or leave it empty.';
  if (!c.company) e['start-company'] = 'Enter your company name.';
  if (!c.industry) e['start-industry'] = 'Choose your industry or business type.';
  if (!c.companySize) e['start-size'] = 'Choose your company size.';
  if (!REGIONS.includes(c.region)) e['start-region'] = 'Choose where you mainly operate.';
  if (c.website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/i.test(c.website)) e['start-website'] = 'Enter a website like company.com, or leave it empty.';
  if (!c.useCase) e['start-usecase'] = 'Choose your main use case (or “Not sure yet”).';
  if (Number.isNaN(c.estUsers) || (c.estUsers != null && c.estUsers > 50000)) e['start-users'] = 'Enter a whole number of people (0–50,000), or leave it empty.';
  if (!TIMELINES[c.timeline]) e['start-timeline'] = 'Choose when you plan to start (or “Not sure”).';
  if (!BUDGETS[c.budget]) e['start-budget'] = 'Choose a budget range (or “Not sure”).';
  return e;
}
/** A simple, explainable lead priority for staff triage (demo rule, not a scoring model). */
export function leadPriority(c = {}) {
  let n = 0; const why = [];
  if (c.timeline === 'this_month') { n += 2; why.push('starting this month'); } else if (c.timeline === 'this_quarter') { n += 1; why.push('starting this quarter'); }
  if (['1k_5k', '5k_20k', 'over_20k'].includes(c.budget)) { n += 1; why.push('budget stated'); }
  if (c.decisionRole === 'decision_maker') { n += 1; why.push('decision maker'); }
  if (c.estUsers >= 10) { n += 1; why.push(`${c.estUsers} users`); }
  return { level: n >= 4 ? 'hot' : n >= 2 ? 'warm' : 'cold', label: n >= 4 ? 'Hot' : n >= 2 ? 'Warm' : 'Cold', why: why.join(', ') || 'no buying signals yet' };
}
export const hasContact = (draft) => !!draft.contact?.capturedAt;
const session = (platform, draft) => draft.sessionId && platform.cartSessions.find((x) => x.id === draft.sessionId);

/** Capture (or update) the buyer's contact and open their cart session. Must happen before products can be selected. */
export function startSession(platform, draft, input, now = clock.now()) {
  const e = validateStartContact(input);
  if (Object.keys(e).length) throw Object.assign(new Error(Object.values(e)[0]), { fields: e });
  const contact = { ...normaliseLead(input), consentAt: input.followUpConsent ? (draft.contact?.followUpConsent ? draft.contact.consentAt : now) : null, capturedAt: draft.contact?.capturedAt || now };
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
  const lines = q.lines.map((l) => ({ skuId: l.skuId, skuName: l.skuName, metricLabel: l.metricLabel, detail: `${l.metricLabel}: ${l.usage ? `usage, ${l.usage.includedUnits} ${l.usage.unitLabel}s included` : l.bundleSeats != null ? `${l.bundleSeats} bundle seats` : l.units != null ? `${l.units} ${l.unitLabel}${l.units === 1 ? '' : 's'}` : l.components.map((c) => `${c.seats} ${c.productName}`).join(' + ')}` }));
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
export function cartBrief(s, status, money, labels = {}) {
  const c = s.contact, pr = leadPriority(c);
  return [`VeriDex cart follow-up brief (demo) — ${s.id}`, `Status: ${status}. Lead priority: ${pr.label} (${pr.why}). Nothing has been sent to this buyer.`, '',
    'CONTACT', `Name: ${c.name}`, c.jobTitle ? `Job title: ${c.jobTitle}` : '', `Role in decision: ${ROLES_IN_DECISION[c.decisionRole] || 'Not sure'}`, `Email: ${c.email}`, c.phone ? `Phone: ${c.phone}` : '',
    `Follow-up permission: ${c.followUpConsent ? `given ${c.consentAt}` : 'NOT given — do not contact about this cart'}`, '',
    'BUSINESS', `Company: ${c.company}`, `Industry: ${c.industry || '—'}`, `Company size: ${c.companySize || '—'}`, `Region: ${c.region || '—'}`, c.website ? `Website: ${c.website}` : '', c.currentSystem ? `Current system: ${c.currentSystem}` : '', '',
    'REQUIREMENTS', `Main use case: ${c.useCase || '—'}`, `Interested in: ${(c.interests || []).join(', ') || 'Not stated'}`, `Estimated users: ${c.estUsers ?? 'Not stated'}`,
    `Budget: ${BUDGETS[c.budget] || '—'}`, `Timeline: ${TIMELINES[c.timeline] || '—'}`, c.notes ? `Notes: ${c.notes}` : '', c.heardFrom ? `Heard about VeriDex: ${c.heardFrom}` : '', '',
    'CART', `Journey: ${s.persona}`, `Started: ${s.startedAt}`, `Last activity: ${s.lastActivityAt}`, `Furthest stage: ${STAGES[s.stage]}`, `Billing: ${s.cadence}`,
    ...(s.lines.length ? s.lines.map((l) => `  ${l.skuId}  ${l.skuName} — ${l.detail}`) : ['  (empty)']),
    `Recurring per month incl. SMA: ${money(s.recurringMonthlyMinor)}`, `One-time services: ${money(s.oneTimeMinor)}`, `Due today if bought: ${money(s.dueTodayMinor)}`].filter((x) => x !== '').join('\n');
}
