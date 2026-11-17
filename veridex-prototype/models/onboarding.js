// Post-payment onboarding model: step guards, validation and checklist definitions.
import { evaluate, gate, setConfirmation } from './checklist.js';
import { capacity, liveMembers, addMember } from './licensing.js';
import { log } from './workspace.js';
import { clock } from './ids.js';

export const STEPS = [
  { id: 'workspace', label: 'Organization & workspace' },
  { id: 'people', label: 'People & access' },
  { id: 'invitations', label: 'Invitations' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'success', label: 'Finish' },
];
export const REGIONS = ['United States (East)', 'United States (West)', 'Canada', 'European Union'];
export const SIGN_IN = { sso: 'Single sign-on (set up later with your identity provider)', password: 'Email and password with multi-factor', magic: 'Email sign-in links' };

export function validateOrg(org = {}, persona) {
  const e = {};
  const req = (k, msg) => { if (!(org[k] || '').trim()) e[k] = msg; };
  req('orgName', 'Enter the organization people will sign in to.');
  req('businessType', 'Choose a business type.');
  req('workspaceName', 'Enter a workspace name.');
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(org.workspaceSlug || '')) e.workspaceSlug = 'Use 3–30 lowercase letters, numbers or hyphens, e.g. northwind-claims.';
  req('adminName', 'Enter the administrator name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((org.adminEmail || '').trim())) e.adminEmail = 'Enter a valid administrator email.';
  if (!REGIONS.includes(org.region)) e.region = 'Choose a preferred data region.';
  if (persona === 'carrier' && !(org.lines || []).length) e.lines = 'Select at least one line of business.';
  return e;
}
const orgOk = (ws) => !Object.keys(validateOrg(ws.onboarding.org, ws.persona)).length;
const seatsKey = (ws) => [ws.assignments.map((a) => [a.memberId, a.productId, a.role]), liveMembers(ws).map((m) => m.id), Object.values(ws.entitlements).map((e) => e.purchased)];

export const CHECKLISTS = {
  workspace: [
    { id: 'org-valid', kind: 'auto', required: true, label: 'Organization and workspace details are complete', check: orgOk },
    { id: 'admin-set', kind: 'auto', required: true, label: 'A workspace administrator is nominated', check: (ws) => liveMembers(ws).some((m) => m.isAdmin) },
    { id: 'admin-free', kind: 'confirm', required: true, label: 'I understand the administrator role is free and gives no module access on its own', covers: (ws) => ws.onboarding.org.adminEmail || '' },
    { id: 'region-reviewed', kind: 'confirm', required: false, label: 'Data-region preference reviewed with IT or compliance', hint: 'Recommended. You can skip this and follow up later.', covers: (ws) => ws.onboarding.org.region || '' },
  ],
  people: [
    { id: 'within-capacity', kind: 'auto', required: true, label: 'Every module is within its purchased seats', check: (ws) => capacity(ws).every((c) => c.available >= 0) },
    { id: 'alloc-reviewed', kind: 'confirm', required: true, label: 'I have reviewed who holds a seat in each module', hint: 'Changing people, seats or roles clears this confirmation.', covers: seatsKey },
    { id: 'someone-assigned', kind: 'auto', required: false, label: 'At least one person has module access', hint: 'Recommended. Unassigned seats remain paid.', check: (ws) => ws.assignments.length > 0 },
  ],
  invitations: [
    { id: 'invite-decision', kind: 'auto', required: true, label: 'Invitations are sent, or explicitly deferred', check: (ws) => !!ws.onboarding.inviteDecision || !liveMembers(ws).some((m) => m.status === 'draft') },
    { id: 'none-expired', kind: 'auto', required: false, label: 'No expired invitations are holding seats', hint: 'Recommended. Resend or revoke expired invitations.', check: (ws) => !ws.members.some((m) => m.status === 'expired') },
  ],
  readiness: [
    { id: 'signin', kind: 'auto', required: true, label: 'A sign-in preference is chosen', check: (ws) => !!SIGN_IN[ws.onboarding.readiness.signIn] },
    { id: 'regions', kind: 'auto', required: true, when: (ws) => ws.persona === 'carrier', label: 'At least one operating region is selected', check: (ws) => ws.onboarding.readiness.regions.length > 0 },
    { id: 'modules-reviewed', kind: 'confirm', required: true, label: 'Module visibility and enablement reviewed', hint: 'Changing a module setting clears this confirmation.', covers: (ws) => [Object.values(ws.entitlements).map((e) => [e.productId, e.enabled, e.visible]), ws.onboarding.readiness] },
    { id: 'rollout', kind: 'auto', required: false, when: (ws) => ws.persona === 'carrier', label: 'Rollout approach noted', hint: 'Recommended for carriers.', check: (ws) => !!ws.onboarding.readiness.rollout },
  ],
  success: [],
};
export const checklist = (ws, stepId) => evaluate(CHECKLISTS[stepId], ws, ws.onboarding.confirmations);
export const stepGate = (ws, stepId) => gate(checklist(ws, stepId));
export function confirm(ws, stepId, id, on) { setConfirmation(CHECKLISTS[stepId], ws, ws.onboarding.confirmations, id, on); }

/** Guard used by every onboarding entry point, including direct links. */
export function canEnter(ws, index) {
  if (!ws.onboarding.unlocked) return { ok: false, reason: 'locked' };
  for (let i = 0; i < index; i++) if (!stepGate(ws, STEPS[i].id).ok) return { ok: false, reason: 'blocked', blockedBy: i };
  return { ok: true };
}
export function stepStates(ws) {
  return STEPS.map((s, i) => {
    const enter = canEnter(ws, i);
    const done = stepGate(ws, s.id).ok && (i < ws.onboarding.step || !!ws.onboarding.completedAt);
    return { ...s, index: i, state: !enter.ok ? 'blocked' : i === ws.onboarding.step ? 'current' : done ? 'complete' : 'available' };
  });
}
export function goTo(ws, index) {
  const r = canEnter(ws, index);
  if (!r.ok) throw new Error(r.reason === 'locked' ? 'Onboarding unlocks after a successful purchase.' : `Complete “${STEPS[r.blockedBy].label}” first.`);
  ws.onboarding.step = index;
}
/** Save organization details and create/update the nominated administrator membership (holds no seat). */
export function saveOrg(ws, org) {
  if (!ws.onboarding.unlocked) throw new Error('Onboarding unlocks after a successful purchase.');
  ws.onboarding.org = { ...ws.onboarding.org, ...org };
  const errors = validateOrg(ws.onboarding.org, ws.persona);
  if (!errors.adminName && !errors.adminEmail) {
    const o = ws.onboarding.org;
    let admin = ws.members.find((m) => m.id === o.adminMemberId && m.status !== 'revoked');
    if (admin) { admin.name = o.adminName.trim(); admin.email = o.adminEmail.trim(); }
    else { admin = addMember(ws, { name: o.adminName, email: o.adminEmail, type: 'employee', isAdmin: true, status: 'active' }).member; admin.isAdmin = true; o.adminMemberId = admin.id; }
  }
  return errors;
}
export function complete(ws, now = clock.now()) {
  for (const s of STEPS.slice(0, 4)) if (!stepGate(ws, s.id).ok) throw new Error(`Complete “${s.label}” first.`);
  ws.onboarding.completedAt = now; ws.onboarding.step = 4;
  log(ws, 'Onboarding completed (demo — no workspace was provisioned)', '', now);
}
