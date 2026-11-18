// Lead model for assisted-sales intake and chat follow-ups. A lead is a REQUEST: never a booked meeting or delivered message.
import { nextId, clock } from './ids.js';
export const LEAD_STATUS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', closed: 'Closed' };
export const OWNERS = ['Unassigned', 'Dana Whitfield', 'Ravi Menon', 'Sofia Alvarez'];
export const FOLLOW_UPS = { email: 'Email reply', call: 'Phone or video call request', demo: 'Product demo request', setup: 'Setup call request' };
export function validateLead(input = {}) {
  const e = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((input.email || '').trim())) e.email = 'Enter a reply email, e.g. name@company.com.';
  if (!input.consent) e.consent = 'Tick the box to allow VeriDex to contact you about this request.';
  if (!FOLLOW_UPS[input.followUp]) e.followUp = 'Choose how you would like us to follow up.';
  return e;
}
export function createLead(platform, input, now = clock.now()) {
  const e = validateLead(input);
  if (Object.keys(e).length) throw Object.assign(new Error(Object.values(e)[0]), { fields: e });
  const lead = { id: nextId(platform, 'lead'), createdAt: now, source: input.source || 'intake', persona: input.persona || 'tenant', orgType: input.orgType || 'Not sure', size: input.size || 'Not sure',
    interests: (input.interests || []).slice(0, 12), goals: (input.goals || '').slice(0, 600), timing: input.timing || 'Not sure', email: input.email.trim(), followUp: input.followUp, consent: true,
    context: input.context || '', status: 'new', owner: 'Unassigned', notes: [], synthetic: !!input.synthetic };
  platform.leads.unshift(lead);
  return lead;
}
export function updateLead(platform, id, patch, now = clock.now()) {
  const l = platform.leads.find((x) => x.id === id);
  if (!l) throw new Error('Lead not found.');
  if (patch.status && LEAD_STATUS[patch.status]) l.status = patch.status;
  if (patch.owner && OWNERS.includes(patch.owner)) l.owner = patch.owner;
  if (patch.note?.trim()) l.notes.unshift({ at: now, text: patch.note.trim().slice(0, 500) });
  return l;
}
export function leadBrief(l) {
  return [`VeriDex lead brief (demo) — ${l.id}`, `Recorded: ${l.createdAt}`, `Status: request recorded. No meeting is booked and no message has been sent.`, '',
    `Journey: ${l.persona}`, `Source: ${l.source}`, `Organization type: ${l.orgType}`, `Approximate size: ${l.size}`, `Interests: ${l.interests.join(', ') || 'Not sure'}`,
    `Goals: ${l.goals || '—'}`, `Timing: ${l.timing}`, `Reply email: ${l.email}`, `Preferred follow-up: ${FOLLOW_UPS[l.followUp]}`, `Contact permission: given`, l.context ? `Context: ${l.context}` : ''].filter((x) => x !== '').join('\n');
}
