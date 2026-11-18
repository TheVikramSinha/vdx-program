// Onboarding controller. Every transition goes through the onboarding model guards.
import { personaFromPage, loadState, mount, toast, html, openDialog, confirmDialog } from './base.js';
import { onboarding, locked } from '../views/templates/onboarding.js';
import { alert } from '../views/templates/components.js';
import { personaOf } from '../data/personas.js';
import * as O from '../models/onboarding.js';
import * as L from '../models/licensing.js';
import { invitations } from '../services/invitationMock.js';
import { initChat } from './chat.js';

const pid = personaFromPage(), persona = personaOf(pid), S = loadState(pid);
const local = { errors: {}, gateErrors: null, personErrors: {}, personDraft: { name: '', email: '', type: 'employee' }, prefilled: false };
const ob = () => S.ws.onboarding;
// Prefill the administrator from the receipt contact once (purchaser is the likeliest admin; editable).
if (ob().unlocked && !ob().org.adminEmail) {
  const c = S.platform.orders.find((o) => o.id === S.ws.orders[0])?.contact;
  if (c) { Object.assign(ob().org, { adminName: c.name, adminEmail: c.email, orgName: ob().org.orgName || c.company || '' }); local.prefilled = true; }
}
// Direct links cannot jump ahead: clamp the saved step to what the guards allow.
if (ob().unlocked) while (ob().step > 0 && !O.canEnter(S.ws, ob().step).ok) ob().step--;

function view() {
  if (!ob().unlocked) return locked(persona);
  const step = ob().step, stepId = O.STEPS[step].id;
  const skipped = O.STEPS.slice(0, 4).flatMap((s) => O.stepGate(S.ws, s.id).skipped.map((i) => i.label));
  return onboarding({ ws: S.ws, persona, step, states: O.stepStates(S.ws), checklist: O.checklist(S.ws, stepId), gate: O.stepGate(S.ws, stepId), cap: L.capacity(S.ws), totals: L.totals(S.ws),
    orders: S.platform.orders.filter((o) => S.ws.orders.includes(o.id)), skipped, ...local });
}
const commit = () => { S.save(); app.refresh(); };
const go = (i) => { O.goTo(S.ws, i); local.gateErrors = null; local.errors = {}; commit(); window.scrollTo(0, 0); document.getElementById('main').focus({ preventScroll: true }); };
async function importCsv(text) {
  const parsed = L.parseCsv(S.ws, text);
  if (parsed.error) return toast(parsed.error, 'error');
  const good = parsed.rows.filter((r) => !r.errors.length);
  const ok = await openDialog({ title: 'Review CSV import', wide: true, body: html`
    <p>${good.length} of ${parsed.rows.length} rows can be imported. Rows with problems are skipped; nothing is imported until you confirm.</p>
    <div class="table-wrap"><table><thead><tr><th>Line</th><th>Person</th><th>Seats</th><th>Result</th></tr></thead><tbody>${parsed.rows.map((r) => html`<tr><td>${r.line}</td><td>${r.name}<br><span class="small muted">${r.email}</span></td><td>${r.seats.map((s) => `${S.ws.entitlements[s.productId].productName} (${s.role})`).join(', ') || '—'}</td>
      <td>${r.errors.length ? html`<span style="color:var(--rust);font-weight:600">Skipped: ${r.errors.join(' ')}</span>` : 'Ready'}</td></tr>`)}</tbody></table></div>`,
    actions: [{ label: 'Cancel', value: false, kind: 'ghost' }, { label: `Import ${good.length} ${good.length === 1 ? 'person' : 'people'}`, value: true, kind: 'primary' }] });
  if (!ok || !good.length) return;
  const n = L.applyCsv(S.ws, parsed); commit(); toast(`${n} ${n === 1 ? 'person' : 'people'} imported.`);
}
const app = mount({ page: 'onboarding', persona: pid, view, handlers: {
  goto: (el) => go(+el.dataset.id),
  back: () => go(Math.max(0, ob().step - 1)),
  next: () => {
    const step = ob().step, id = O.STEPS[step].id;
    if (step === 0) { local.errors = O.saveOrg(S.ws, ob().org); }
    const g = O.stepGate(S.ws, id);
    if (!g.ok || Object.keys(local.errors).length) {
      local.gateErrors = { ...local.errors, ...Object.fromEntries(g.missing.filter((m) => m.id !== 'org-valid' || !Object.keys(local.errors).length).map((m) => [`cl-${m.id}`, m.label])) };
      commit(); document.getElementById('error-summary')?.focus(); return;
    }
    go(step + 1);
  },
  'save-org': () => {},
  org: (el) => { const v = el.id === 'workspaceSlug' ? el.value.trim().toLowerCase() : el.value; local.errors = {}; O.saveOrg(S.ws, { [el.id]: v }); local.prefilled = false; commit(); },
  'org-line': (el) => { const set = new Set(ob().org.lines || []); el.checked ? set.add(el.value) : set.delete(el.value); O.saveOrg(S.ws, { lines: [...set] }); commit(); },
  'check-toggle': (el) => { O.confirm(S.ws, O.STEPS[ob().step].id, el.dataset.id, el.checked); local.gateErrors = null; commit(); },
  'add-person': (f) => {
    const input = { name: f.elements['p-name'].value, email: f.elements['p-email'].value, type: f.elements['p-type'].value };
    local.personErrors = L.validateMember(S.ws, input); local.personDraft = input;
    if (Object.keys(local.personErrors).length) { commit(); document.getElementById(local.personErrors.name ? 'p-name' : 'p-email').focus(); return; }
    L.addMember(S.ws, input); local.personDraft = { name: '', email: '', type: 'employee' }; commit(); document.getElementById('p-name').focus();
  },
  seat: (el) => { try { el.checked ? L.assign(S.ws, el.dataset.id, el.dataset.pid, ob().readiness.defaultRole) : L.unassign(S.ws, el.dataset.id, el.dataset.pid); } finally { commit(); } },
  role: (el) => { L.setRole(S.ws, el.dataset.id, el.dataset.pid, el.value); commit(); },
  'remove-person': async (el) => {
    const m = L.member(S.ws, el.dataset.id);
    if (!(await confirmDialog({ title: `Remove ${m.name}?`, body: html`<p>Their ${L.seatsOf(S.ws, m.id).length} seat(s) return to the same modules. Billing does not change.</p>`, confirmLabel: 'Remove' }))) return;
    L.revoke(S.ws, m.id); commit();
  },
  'import-sample': async () => importCsv(await (await fetch('data/sample-team.csv')).text()),
  'csv-file': async (el) => { const f = el.files[0]; if (!f) return; if (f.size > 200000) return toast('The file is too large (limit 200 KB).', 'error'); await importCsv(await f.text()); },
  'send-all': async () => { for (const m of L.liveMembers(S.ws).filter((x) => x.status === 'draft')) { await invitations.send(m); L.sendInvite(S.ws, m.id); } ob().inviteDecision = 'sent'; commit(); toast('Invitations recorded (simulated). No email was sent.'); },
  defer: () => { ob().inviteDecision = 'deferred'; commit(); toast('Invitations deferred. Seats stay reserved for these people.'); },
  invite: async (el) => { await invitations.send(L.member(S.ws, el.dataset.id)); L.sendInvite(S.ws, el.dataset.id); commit(); toast('Invitation recorded (simulated).'); },
  revoke: async (el) => { const m = L.member(S.ws, el.dataset.id); if (!(await confirmDialog({ title: `Revoke ${m.name}’s invitation?`, body: html`<p>Their reserved seats are released back to the same modules. Billing does not change.</p>`, confirmLabel: 'Revoke' }))) return; L.revoke(S.ws, m.id); commit(); },
  'sim-accept': (el) => { L.acceptInvite(S.ws, el.dataset.id); commit(); },
  'sim-expire': (el) => { L.expireInvite(S.ws, el.dataset.id); commit(); },
  ready: (el) => { ob().readiness[el.name || el.id] = el.value; commit(); },
  'ready-region': (el) => { const set = new Set(ob().readiness.regions); el.checked ? set.add(el.value) : set.delete(el.value); ob().readiness.regions = [...set]; commit(); },
  flag: (el) => { L.setModuleFlag(S.ws, el.dataset.pid, el.dataset.arg, el.checked); commit(); },
  finish: () => { O.complete(S.ws); commit(); toast('Setup recorded in the demo.'); },
} });
initChat(S, () => ({ persona: persona.short, step: ob().unlocked ? `Onboarding: ${O.STEPS[ob().step].label}` : 'Onboarding (locked)', products: Object.values(S.ws.entitlements).map((e) => e.productName) }));
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
