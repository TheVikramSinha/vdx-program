// Tenant Admin controller (customer scope only: one workspace, its people, seats and billing).
import { personaFromPage, loadState, mount, toast, html, openDialog, confirmDialog } from './base.js';
import { tenantAdmin, TABS } from '../views/templates/tenantAdmin.js';
import { alert, field, money, date } from '../views/templates/components.js';
import { personaOf } from '../data/personas.js';
import * as L from '../models/licensing.js';
import { previewAddSeats, completeAddSeats, reduceSeats, recordUsage, advanceService, seatTarget } from '../models/orders.js';
import { createLead } from '../models/leads.js';
import { nextId } from '../models/ids.js';
import { toQty, bpsLabel } from '../models/money.js';
import { authorize, METHODS } from '../services/paymentMock.js';
import { initChat } from './chat.js';

const pid = personaFromPage(), persona = personaOf(pid), S = loadState(pid);
const local = { filter: { q: '', status: 'all', module: 'all' } };
const tab = () => (TABS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
const cat = () => S.platform.catalog.published;
const view = () => tenantAdmin({ ws: S.ws, persona, tab: tab(), cap: L.capacity(S.ws), totals: L.totals(S.ws), orders: S.platform.orders.filter((o) => S.ws.orders.includes(o.id)), ...local });
const commit = () => { S.save(); app.refresh(); };

function memberBody(m) {
  const seats = L.seatsOf(S.ws, m.id), cap = L.accessModules(S.ws), users = L.userLicences(S.ws);
  return html`<div class="form-grid">${field({ id: 'm-name', label: 'Name', value: m.name })}${field({ id: 'm-email', label: 'Work email', type: 'email', value: m.email, hint: `Stable member id ${m.id} does not change when the email does.` })}
    ${field({ id: 'm-type', label: 'Membership type', value: m.type, options: Object.entries(L.MEMBER_TYPES) })}
    <label class="check" style="align-self:end"><input type="checkbox" name="m-admin" ${m.isAdmin ? html`checked` : ''}><span><b>Workspace administrator</b><br><span class="small muted">Free. Uses no seat and gives no module access.</span></span></label></div>
    ${users ? html`<p class="small muted" style="margin:0">VeriDex Core user licences: ${users.available} of ${users.purchased} free. ${seats.length ? `${m.name} already holds one.` : 'Giving this person any module seat uses one.'}</p>` : ''}
    <fieldset><legend>Module access</legend><div class="stack-sm">${cap.map((c) => { const a = seats.find((s) => s.productId === c.productId); const lim = L.seatLimitFor(S.ws, c.productId); const full = !a && lim && lim.available < 1;
      const note = !lim ? `${c.metricLabel} · no seat limit` : lim.kind === 'pool' ? `${full ? 'bundle pool full — buy bundle seats or free one' : `${lim.available} of ${lim.purchased} bundle seats left`} (shared)` : full ? `full (${lim.purchased}/${lim.purchased}) — buy seats or free one` : `${lim.available} of ${lim.purchased} seats available`;
      return html`<div class="row between choice" style="cursor:default"><label class="check" style="padding:0"><input type="checkbox" name="seat-${c.productId}" ${a ? html`checked` : ''} ${full ? html`disabled` : ''}><span><b>${c.productName}</b> <span class="small muted">${c.tierName} · ${note}</span></span></label>
        <select name="role-${c.productId}" aria-label="${c.productName} role" style="width:auto">${L.ROLES.map((r) => html`<option ${r === (a?.role || S.ws.onboarding.readiness.defaultRole) ? html`selected` : ''}>${r}</option>`)}</select></div>`; })}</div></fieldset>
    <p class="small muted">Removing access frees the seat where it came from (that module, or the shared bundle pool). Your bill does not change until you reduce purchased seats under Plan &amp; billing.</p>`;
}
function saveMember(m, fd) {
  L.updateMember(S.ws, m.id, { name: fd.get('m-name'), email: fd.get('m-email'), type: fd.get('m-type') });
  if ((fd.get('m-admin') === 'on') !== m.isAdmin) L.setAdmin(S.ws, m.id, fd.get('m-admin') === 'on');
  for (const c of L.accessModules(S.ws)) {
    const want = fd.get(`seat-${c.productId}`) === 'on', has = L.seatsOf(S.ws, m.id).find((s) => s.productId === c.productId), role = fd.get(`role-${c.productId}`);
    if (want && !has) L.assign(S.ws, m.id, c.productId, role); else if (!want && has) L.unassign(S.ws, m.id, c.productId); else if (has && has.role !== role) L.setRole(S.ws, m.id, c.productId, role);
  }
}
const app = mount({ page: 'tenant-admin', persona: pid, view, handlers: {
  filter: (el) => { local.filter[el.id.slice(2)] = el.value; app.refresh(); },
  'add-member': async () => {
    const draft = { id: 'new', name: '', email: '', type: 'employee', isAdmin: false };
    await openDialog({ title: 'Add person', body: memberBody(draft), actions: [{ label: 'Cancel', value: null }, { label: 'Add person', submit: true, kind: 'primary' }],
      onSubmit: (fd) => {
        const input = { name: fd.get('m-name'), email: fd.get('m-email'), type: fd.get('m-type') };
        const e = L.validateMember(S.ws, input); if (Object.keys(e).length) throw new Error(Object.values(e).join(' '));
        const { member } = L.addMember(S.ws, input);
        try { saveMember(member, fd); } finally { S.save(); }
      } });
    commit();
  },
  member: async (el) => {
    const m = L.member(S.ws, el.dataset.id);
    const r = await openDialog({ title: `Manage ${m.name}`, body: html`${memberBody(m)}<hr><div class="row">
        ${m.status === 'active' ? html`<button type="button" class="btn btn-ghost btn-sm" data-value="1">Suspend (keeps seats)</button>` : ''}${m.status === 'suspended' ? html`<button type="button" class="btn btn-ghost btn-sm" data-value="2">Reinstate</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-value="3">Revoke access and release seats</button></div>`,
      actions: [{ label: 'Cancel', value: null }, { value: 'suspend' }, { value: 'reinstate' }, { value: 'revoke' }, { label: 'Save changes', submit: true, kind: 'primary' }].map((a) => a),
      onMount: (d) => d.querySelectorAll('.dlg-foot [data-value="1"], .dlg-foot [data-value="2"], .dlg-foot [data-value="3"]').forEach((b) => b.remove()),
      onSubmit: (fd) => { try { saveMember(m, fd); } finally { S.save(); } } });
    if (r === 'suspend') L.suspend(S.ws, m.id);
    if (r === 'reinstate') L.reinstate(S.ws, m.id);
    if (r === 'revoke') { if (await confirmDialog({ title: `Revoke ${m.name}?`, body: html`<p>${L.seatsOf(S.ws, m.id).length} seat(s)${L.userLicences(S.ws) && L.seatsOf(S.ws, m.id).length ? ' and one user licence' : ''} are released. Billing does not change.</p>`, confirmLabel: 'Revoke access' })) L.revoke(S.ws, m.id); }
    commit();
  },
  invite: (el) => { L.sendInvite(S.ws, el.dataset.id); commit(); toast('Invitation recorded (simulated). No email was sent.'); },
  revoke: async (el) => { const m = L.member(S.ws, el.dataset.id); if (await confirmDialog({ title: `Revoke ${m.name}?`, body: html`<p>Reserved seats are released. Billing does not change.</p>`, confirmLabel: 'Revoke' })) { L.revoke(S.ws, m.id); commit(); } },
  'sim-accept': (el) => { L.acceptInvite(S.ws, el.dataset.id); commit(); },
  'sim-expire': (el) => { L.expireInvite(S.ws, el.dataset.id); commit(); },
  buy: async (el) => {
    const t = seatTarget(S.ws, el.dataset.id), user = t.entitlement?.kind === 'platform';
    const session = { id: nextId(S.ws, 'addchk'), productId: t.id, seats: 1, attempts: 0 };
    const unitWord = t.pool ? 'per bundle seat' : user ? 'per user' : 'per seat';
    const preview = (n) => { try { const p = previewAddSeats(cat(), S.ws, t.id, n); const l = p.quote.lines[0]; return html`<dl class="kv"><dt>SKU</dt><dd>${p.sku.name} <span class="mono muted">${p.sku.id}</span> · ${l.metricLabel} · current catalog price</dd><dt>Price</dt><dd>${money(t.pool ? l.bundleSeatPriceMinor : l.components[0].unitListMinor)} ${unitWord} / month × ${n}</dd><dt>SMA</dt><dd>${money(p.quote.smaMonthlyMinor)} / month (${bpsLabel(p.quote.smaBps)} of the added licence fees)</dd>
        <dt>Illustrative proration</dt><dd>${p.daysLeft} of ${p.termDays} days left in this term → ${money(p.proratedMinor)}</dd><dt>Estimated tax</dt><dd>${money(p.taxMinor)}</dd><dt><b>Due now</b></dt><dd><b>${money(p.dueNowMinor)}</b></dd><dt>At renewal (${date(p.renewsAt)})</dt><dd>+${money(p.quote.subtotalMinor)} per term before tax</dd>
        <dt>New capacity</dt><dd>${t.name}: ${t.purchased} → <b>${t.purchased + n}</b> ${t.noun}. ${t.pool ? 'Shared by the bundle’s modules.' : 'Other modules unchanged.'}</dd></dl>`; } catch (err) { return alert('danger', err.message); } };
    const done = await openDialog({ title: `Buy ${t.pool ? t.name : `${t.name} ${t.noun}`}`, body: html`<p class="small muted">Capacity changes only after a successful simulated payment. Nothing is bought automatically.</p>
        <div style="max-width:240px">${field({ id: 'add-n', label: `Extra ${t.pool ? 'bundle seats' : user ? `${t.name} user licences` : `${t.name} ${t.entitlement.tierName} seats`}`, type: 'number', value: 1, attrs: 'min="1" max="500" step="1"' })}</div><div data-preview>${preview(1)}</div>
        <fieldset><legend>Demo payment method</legend><div class="stack-sm">${Object.entries(METHODS).map(([k, m], i) => html`<label class="choice"><input type="radio" name="method" value="${k}" ${i === 0 ? html`checked` : ''}><span>${m.label}</span></label>`)}</div></fieldset>`,
      actions: [{ label: 'Cancel', value: null }, { label: 'Pay and add seats (simulated)', submit: true, kind: 'primary' }],
      onMount: (d) => d.querySelector('#add-n').addEventListener('input', (ev) => { const n = toQty(ev.target.value); d.querySelector('[data-preview]').innerHTML = String(n ? preview(n) : alert('danger', 'Enter a whole number of seats.')); }),
      onSubmit: async (fd, d) => {
        const n = toQty(fd.get('add-n')); if (!n || n > 500) throw new Error('Enter a whole number of seats between 1 and 500.');
        session.seats = n; const p = previewAddSeats(cat(), S.ws, t.id, n);
        const btn = d.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = 'Processing…';
        const result = await authorize({ method: fd.get('method'), amountMinor: p.dueNowMinor, currency: 'USD', idempotencyKey: session.id, delay: 400 });
        const out = completeAddSeats({ platform: S.platform, ws: S.ws, session, result }); S.save();
        btn.disabled = false; btn.textContent = 'Pay and add seats (simulated)';
        if (!out.order) throw new Error(`${result.message} Capacity is unchanged. You can try again.`);
      } });
    commit(); if (done) toast(`${t.name} ${t.pool ? '' : t.noun + ' '}added after simulated payment.`);
  },
  reduce: async (el) => {
    const c = L.moduleCapacity(S.ws, el.dataset.id), used = c.assigned + c.reserved;
    const ok = await openDialog({ title: `Reduce ${c.productName} ${c.kind === 'pool' ? 'bundle seats' : c.kind === 'platform' ? 'user licences' : 'seats'}`, body: html`${alert('warning', 'This is a billing change.', html`<p class="small">You have ${c.purchased} purchased, ${used} assigned or reserved. You cannot go below ${used} without removing access first. Demo policy: the lower charge starts at the next renewal; no refund is shown.</p>`)}
        <div style="max-width:240px">${field({ id: 'red-n', label: 'New purchased seats', type: 'number', value: Math.max(used, c.purchased - 1), attrs: `min="${used}" max="${c.purchased - 1}" step="1"` })}</div>
        <label class="check"><input type="checkbox" name="red-ok"><span>I confirm this reduces what we are billed for ${c.productName} from the next renewal.</span></label>`,
      actions: [{ label: 'Cancel', value: null }, { label: 'Reduce seats', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { if (fd.get('red-ok') !== 'on') throw new Error('Tick the confirmation to continue.'); const n = toQty(fd.get('red-n')); if (n == null) throw new Error('Enter a whole number.'); reduceSeats({ platform: S.platform, ws: S.ws, productId: c.productId, newCount: n, occupied: used }); } });
    commit(); if (ok) toast('Purchased seats reduced. Billing changes at next renewal (demo policy).');
  },
  usage: (el) => { recordUsage(S.ws, el.dataset.id, Number(el.dataset.arg)); commit(); toast('Usage recorded (simulated).'); },
  'service-next': (el) => { advanceService(S.ws, el.dataset.id); commit(); },
  'plan-change': async () => {
    const admin = L.liveMembers(S.ws).find((m) => m.isAdmin);
    const ok = await openDialog({ title: 'Request a plan change', body: html`${field({ id: 'pc-what', label: 'What would you like to change?', options: ['Move a module to another tier', 'Switch to a different bundle', 'Change billing cadence', 'Cancel at renewal', 'Something else'] })}
        ${field({ id: 'pc-note', label: 'Details', type: 'textarea', optional: true, attrs: 'maxlength="500"' })}${field({ id: 'pc-email', label: 'Reply email', type: 'email', value: admin?.email || '' })}
        <label class="check"><input type="checkbox" name="pc-consent"><span>VeriDex may contact me about this request.</span></label><p class="small muted">This records a request in the demo. Nothing changes on your plan and no message is sent.</p>`,
      actions: [{ label: 'Cancel', value: null }, { label: 'Record request', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { createLead(S.platform, { source: 'plan-change', persona: pid, email: String(fd.get('pc-email')), consent: fd.get('pc-consent') === 'on', followUp: 'email', goals: `${fd.get('pc-what')}. ${fd.get('pc-note') || ''}`, interests: Object.values(S.ws.entitlements).map((e) => e.productName), context: 'Tenant Admin plan-change request' }); } });
    if (ok) { L && S.ws.activity.unshift({ id: nextId(S.ws, 'act'), at: new Date().toISOString(), action: 'Plan-change request recorded', detail: 'Request only; plan unchanged' }); commit(); toast('Plan-change request recorded (demo).'); }
  },
} });
initChat(S, () => ({ persona: persona.short, step: `Tenant Admin: ${tab()}`, products: Object.values(S.ws.entitlements).map((e) => e.productName) }));
window.addEventListener('hashchange', () => app.refresh());
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
