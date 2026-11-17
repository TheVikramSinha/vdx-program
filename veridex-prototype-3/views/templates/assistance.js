// Guided assistance intake and staff lead inbox views.
import { html } from './html.js';
import { icon, badge, alert, field, errorSummary, dateTime } from './components.js';
import { FOLLOW_UPS, LEAD_STATUS, OWNERS } from '../../models/leads.js';
import { FOLLOW_UP_STATUS, STAGES, ABANDON_OPTIONS } from '../../models/cartSessions.js';
import { money } from './components.js';
const TIMING = ['This month', 'This quarter', 'Next 6 months', 'Just exploring', 'Not sure'];
export function intake(vm) {
  const { persona, d, errors, stage, lead, interests } = vm;
  const q = persona.id === 'carrier' ? '?p=carrier' : '';
  const head = html`<div class="page-head"><div><span class="eyebrow">${persona.short} · expert guidance</span><h1>Tell us a little. We will help you choose.</h1><p>Indicative answers only. No team roster, no workspace name, and your current order is not touched.</p></div>
    <div class="segmented" role="group" aria-label="Journey"><a class="btn btn-sm ${persona.id === 'tenant' ? 'btn-primary' : 'btn-ghost'}" style="border:0;border-radius:0" href="assistance.html">Agency / MGA / TPA</a><a class="btn btn-sm ${persona.id === 'carrier' ? 'btn-primary' : 'btn-ghost'}" style="border:0;border-radius:0" href="assistance.html?p=carrier">Carrier</a></div></div>`;
  if (stage === 'done') return html`${head}<section class="card" style="max-width:760px;border-top:6px solid var(--teal)"><img class="receipt-logo" src="assets/brand/veridex-logo-primary.png" alt="VeriDex Solution.AI"><h2 style="margin-top:var(--s3)">${icon('check')} Request ${lead.id} recorded</h2>
    ${alert('info', 'This is a demo.', html`<p class="small">Your request is stored in this browser’s demo lead inbox. No message was sent to VeriDex, and no meeting is booked. In production a specialist would reply to ${lead.email} by: ${FOLLOW_UPS[lead.followUp].toLowerCase()}.</p>`)}
    <div class="row" style="margin-top:var(--s4)"><button class="btn btn-primary" data-action="brief">${icon('down')} Download lead brief</button><a class="btn btn-ghost" href="${persona.home}">Back to the shop</a><button class="btn-link" data-action="again">Start another request</button></div></section>`;
  if (stage === 'review') return html`${head}<section class="card" style="max-width:760px"><h2>Review your request</h2><dl class="kv"><dt>Journey</dt><dd>${persona.label}</dd><dt>Organization type</dt><dd>${d.orgType || 'Not sure'}</dd><dt>Approximate size</dt><dd>${d.size || 'Not sure'}</dd><dt>Interested in</dt><dd>${(d.interests || []).join(', ') || 'Not sure'}</dd>
    <dt>Main goal</dt><dd>${d.goal || 'Not sure yet'}${d.goals ? html`<br>${d.goals}` : ''}</dd><dt>Timing</dt><dd>${d.timing || 'Not sure'}</dd><dt>Reply email</dt><dd>${d.email}</dd><dt>Follow-up</dt><dd>${FOLLOW_UPS[d.followUp]}</dd><dt>Contact permission</dt><dd>Given</dd></dl>
    <div class="row" style="margin-top:var(--s4)"><button class="btn btn-ghost" data-action="edit">Edit</button><button class="btn btn-primary" data-action="submit">Record request</button></div><p class="small muted" style="margin-top:var(--s2)">Recording creates a request. It does not book a meeting.</p></section>`;
  const sel = (id, label, opts) => field({ id, label, value: d[id] || 'Not sure', options: opts, attrs: 'data-change="f"' });
  return html`${head}<div class="with-aside"><form class="stack" data-submit="review" novalidate>${errorSummary(errors)}
    <section class="card"><h2>About your organization</h2><div class="form-grid">${sel('orgType', 'Organization type', persona.orgTypes)}${sel('size', 'Approximate size', persona.sizes)}</div></section>
    <section class="card"><fieldset><legend><h2 style="margin:0 0 var(--s2)">What are you interested in?</h2></legend><div class="grid g2">${[...interests, 'Not sure'].map((x) => html`<label class="check"><input type="checkbox" data-change="interest" value="${x}" ${(d.interests || []).includes(x) ? html`checked` : ''}><span>${x}</span></label>`)}</div></fieldset>
      <div class="form-grid" style="margin-top:var(--s4)">${field({ id: 'goal', label: 'Main goal', value: d.goal || 'Not sure yet', options: persona.goals, attrs: 'data-change="f"' })}${sel('timing', 'Timing', TIMING)}
        <div class="full">${field({ id: 'goals', label: 'Anything else we should know?', type: 'textarea', value: d.goals, optional: true, hint: 'Please do not include names of team members or other personal data.', attrs: 'data-change="f" maxlength="600"' })}</div></div></section>
    <section class="card"><h2>How should we follow up?</h2><div class="form-grid">${field({ id: 'email', label: 'Reply email', type: 'email', value: d.email, error: errors.email, attrs: 'data-change="f" autocomplete="email"' })}${field({ id: 'followUp', label: 'Preferred follow-up', value: d.followUp || 'email', options: Object.entries(FOLLOW_UPS), error: errors.followUp, attrs: 'data-change="f"' })}</div>
      <label class="check" style="margin-top:var(--s3)"><input type="checkbox" id="consent" data-change="consent" ${d.consent ? html`checked` : ''} ${errors.consent ? html`aria-invalid="true"` : ''}><span>VeriDex may contact me at this email about this request.${errors.consent ? html`<br><span style="color:var(--rust);font-weight:600">${errors.consent}</span>` : ''}</span></label></section>
    <div class="row"><button class="btn btn-primary" type="submit">Review request ${icon('arrow')}</button><button class="btn-link" type="button" data-action="clear">Clear form</button></div></form>
    <aside><section class="card tight flat"><h3>Prefer to buy now?</h3><p class="small">Self-service is always available. Your order is kept separately from this request.</p><a class="btn btn-secondary btn-sm" href="${persona.home}">Go to the ${persona.short.toLowerCase()} shop</a></section>
      <section class="card tight"><h3>What we do not ask</h3><ul class="small"><li>Names or emails of your team</li><li>Workspace name or address</li><li>Payment details</li></ul></section></aside></div>`;
}
const SRC = { intake: 'Guided intake', chat: 'Chat (specialist online)', 'chat-offline': 'Chat (offline follow-up)', 'plan-change': 'Tenant Admin plan change' };
const CART_STATE = { active: ['Active', 'info', 'clock'], abandoned: ['Abandoned', 'warning', 'warn'], converted: ['Purchased', 'success', 'check'] };
function cartsTab(vm) {
  const { carts, cartFilter, abandonAfter } = vm;
  const list = carts.filter((c) => cartFilter === 'all' || c.status === cartFilter);
  const n = (st) => carts.filter((c) => c.status === st).length;
  return html`<div class="row" style="align-items:flex-end;margin-bottom:16px">
      <div class="field"><label for="cf">Show</label><select id="cf" data-change="cart-filter" style="width:auto"><option value="abandoned" ${cartFilter === 'abandoned' ? html`selected` : ''}>Abandoned (${n('abandoned')})</option><option value="active" ${cartFilter === 'active' ? html`selected` : ''}>Active (${n('active')})</option><option value="converted" ${cartFilter === 'converted' ? html`selected` : ''}>Purchased (${n('converted')})</option><option value="all" ${cartFilter === 'all' ? html`selected` : ''}>All (${carts.length})</option></select></div>
      <div class="field"><label for="abandon-after">Count a cart as abandoned</label><select id="abandon-after" data-change="abandon-after" style="width:auto">${ABANDON_OPTIONS.map(([v, l]) => html`<option value="${v}" ${abandonAfter === v ? html`selected` : ''}>${l}</option>`)}</select></div>
      <p class="small muted grow" style="margin:0 0 8px">Every buyer gives contact details before choosing products. A cart with no activity for the chosen time counts as abandoned. Only buyers who gave permission may be contacted.</p></div>
    ${!list.length ? html`<div class="empty"><h3>No carts here</h3><p>Change the filter, or start a cart in the shop.</p></div>` : html`<div class="table-wrap"><table><caption>Cart sessions</caption><thead><tr><th scope="col">Buyer</th><th scope="col">Cart</th><th scope="col">Stage reached</th><th scope="col" class="num">Value</th><th scope="col">Last activity</th><th scope="col">Status</th><th scope="col">Follow-up</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${list.map((c) => html`<tr><th scope="row" style="min-width:190px">${c.contact.name}<br><span class="small muted" style="font-weight:400">${c.contact.company}<br>${c.contact.email}${c.contact.phone ? html` · ${c.contact.phone}` : ''}</span></th>
      <td class="small" style="min-width:260px">${c.lines.length ? c.lines.map((l) => html`<div>${l.skuName} <span class="muted">· ${l.detail}</span></div>`) : html`<span class="muted">Nothing selected yet</span>`}<div class="muted">${c.persona} journey · <span class="mono">${c.id}</span></div></td>
      <td class="small">${STAGES[c.stage]}</td>
      <td class="num">${money(c.recurringMonthlyMinor)}<span class="small muted">/mo</span>${c.oneTimeMinor ? html`<br><span class="small muted">+ ${money(c.oneTimeMinor)} once</span>` : ''}</td>
      <td class="small">${dateTime(c.lastActivityAt)}</td>
      <td>${badge(...CART_STATE[c.status])}</td>
      <td class="small">${c.contact.followUpConsent ? badge(FOLLOW_UP_STATUS[c.followUp.status], c.followUp.status === 'recovered' ? 'success' : c.followUp.status === 'contacted' ? 'info' : 'neutral') : badge('No permission', 'danger', 'stop')}<br><span class="muted">${c.followUp.owner}</span></td>
      <td class="actions"><button class="btn btn-ghost btn-sm" data-action="open-cart" data-id="${c.id}">Open<span class="sr-only"> cart ${c.id}</span></button></td></tr>`)}</tbody></table></div>`}`;
}
function leadsTab(vm) {
  const { leads, filter } = vm;
  const list = leads.filter((l) => filter === 'all' || l.status === filter);
  return html`<div class="row" style="margin-bottom:16px"><div class="field"><label for="lf">Status</label><select id="lf" data-change="filter" style="width:auto"><option value="all">All</option>${Object.entries(LEAD_STATUS).map(([k, l]) => html`<option value="${k}" ${filter === k ? html`selected` : ''}>${l}</option>`)}</select></div></div>
  ${!list.length ? html`<div class="empty"><h3>No leads here</h3><p>Submit a guided request or a chat follow-up, or load a demo scenario.</p></div>` : html`<div class="table-wrap"><table><thead><tr><th scope="col">Lead</th><th scope="col">Source</th><th scope="col">Persona</th><th scope="col">Interest</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Latest note</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${list.map((l) => html`<tr><th scope="row"><span class="mono">${l.id}</span>${l.synthetic ? html` ${badge('Sample', 'outline')}` : ''}<br><span class="small muted">${dateTime(l.createdAt)}<br>${l.email}</span></th><td>${SRC[l.source] || l.source}</td><td>${l.persona}</td><td class="small">${l.interests.join(', ') || 'Not sure'}<br><span class="muted">${l.orgType} · ${l.size}</span></td>
      <td>${badge(LEAD_STATUS[l.status], { new: 'info', contacted: 'warning', qualified: 'success', closed: 'neutral' }[l.status])}</td><td>${l.owner}</td><td class="small">${l.notes[0]?.text || html`<span class="muted">—</span>`}</td><td class="actions"><button class="btn btn-ghost btn-sm" data-action="open" data-id="${l.id}">Open<span class="sr-only"> ${l.id}</span></button></td></tr>`)}</tbody></table></div>`}`;
}
export function inbox(vm) {
  const abandoned = vm.carts.filter((c) => c.status === 'abandoned').length;
  return html`<div class="page-head"><div><span class="eyebrow">${icon('mail')} VeriDex staff · demo</span><h1>Leads and abandoned carts</h1><p>Simulated staff view. Synthetic and demo-created records only; not connected to a CRM. Nothing here sends a message.</p></div></div>
  <nav class="side" aria-label="Inbox sections" style="margin-bottom:20px"><a href="#carts" ${vm.tab === 'carts' ? html`aria-current="page"` : ''}>${icon('cart')} Abandoned carts ${abandoned ? badge(String(abandoned), 'warning') : ''}</a><a href="#leads" ${vm.tab === 'leads' ? html`aria-current="page"` : ''}>${icon('mail')} Leads &amp; requests</a></nav>
  ${vm.tab === 'carts' ? cartsTab(vm) : leadsTab(vm)}`;
}
export function cartDetail(c, status) {
  return html`${c.contact.followUpConsent ? '' : alert('danger', 'No follow-up permission.', html`<p class="small">This buyer did not agree to be contacted about this cart. Do not email or call them about it. The record is kept for reporting only.</p>`)}
    <dl class="kv"><dt>Buyer</dt><dd>${c.contact.name}${c.contact.jobTitle ? `, ${c.contact.jobTitle}` : ''}</dd><dt>Company</dt><dd>${c.contact.company}</dd><dt>Email</dt><dd>${c.contact.email}</dd><dt>Phone</dt><dd>${c.contact.phone || '—'}</dd>
      <dt>Permission</dt><dd>${c.contact.followUpConsent ? `Given ${dateTime(c.contact.consentAt)}` : 'Not given'}</dd><dt>Status</dt><dd>${badge(...CART_STATE[status])} · furthest stage: ${STAGES[c.stage]}</dd>
      <dt>Cart</dt><dd>${c.lines.length ? c.lines.map((l) => html`<div>${l.skuName} <span class="small muted">· ${l.detail}</span></div>`) : 'Nothing selected'}<div class="small muted">${money(c.recurringMonthlyMinor)}/mo recurring incl. SMA${c.oneTimeMinor ? ` · ${money(c.oneTimeMinor)} one-time` : ''} · ${money(c.dueTodayMinor)} due if bought</div></dd></dl>
    <div class="form-grid">${field({ id: 'cd-status', label: 'Follow-up status', value: c.followUp.status, options: Object.entries(FOLLOW_UP_STATUS).filter(([k]) => c.contact.followUpConsent || !['contacted', 'recovered'].includes(k)) })}${field({ id: 'cd-owner', label: 'Owner', value: c.followUp.owner, options: OWNERS })}
      <div class="full">${field({ id: 'cd-note', label: 'Add note', type: 'textarea', optional: true, attrs: 'maxlength="500"' })}</div></div>
    <div><h3>Timeline</h3><ul class="small">${[...c.events].reverse().slice(0, 12).map((e) => html`<li>${dateTime(e.at)} — ${e.text}</li>`)}</ul></div>
    ${c.followUp.notes.length ? html`<div><h3>Notes</h3><ul class="small">${c.followUp.notes.map((n) => html`<li>${dateTime(n.at)} — ${n.text}</li>`)}</ul></div>` : ''}
    <p class="small muted">Recording “Contacted” logs that you reached out. The demo sends nothing.</p>`;
}
export function leadDetail(l) {
  return html`<dl class="kv"><dt>Request</dt><dd>${FOLLOW_UPS[l.followUp]} · contact permission given</dd><dt>Reply email</dt><dd>${l.email}</dd><dt>Persona</dt><dd>${l.persona}</dd><dt>Organization</dt><dd>${l.orgType} · ${l.size}</dd><dt>Interests</dt><dd>${l.interests.join(', ') || 'Not sure'}</dd><dt>Goals</dt><dd>${l.goals || '—'}</dd><dt>Timing</dt><dd>${l.timing}</dd>${l.context ? html`<dt>Context</dt><dd>${l.context}</dd>` : ''}</dl>
    <div class="form-grid">${field({ id: 'ld-status', label: 'Status', value: l.status, options: Object.entries(LEAD_STATUS) })}${field({ id: 'ld-owner', label: 'Owner', value: l.owner, options: OWNERS })}<div class="full">${field({ id: 'ld-note', label: 'Add note or follow-up action', type: 'textarea', optional: true, attrs: 'maxlength="500"' })}</div></div>
    ${l.notes.length ? html`<div><h3>Notes</h3><ul class="small">${l.notes.map((n) => html`<li>${dateTime(n.at)} — ${n.text}</li>`)}</ul></div>` : ''}<p class="small muted">A request is not a booked meeting. Nothing here sends a message.</p>`;
}
