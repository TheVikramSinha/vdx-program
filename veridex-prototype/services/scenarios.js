// Deterministic synthetic demo scenarios, built only through the public model functions.
import { createPlatform } from '../models/platform.js';
import { createWorkspace } from '../models/workspace.js';
import { createDraft, save, resetAll } from './storage.js';
import { setLine, setCadence } from '../models/pricing.js';
import { openCheckout, recordPayment } from '../models/orders.js';
import * as L from '../models/licensing.js';
import * as O from '../models/onboarding.js';
import { createLead } from '../models/leads.js';
import { SEED_LEADS } from '../data/seedLeads.js';
import { clock } from '../models/ids.js';

const T = (d, h = 9) => `2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`;
export const SCENARIOS = {
  fresh: { label: 'Fresh start', detail: 'Empty carts, no purchases. Seeded catalog and sample leads.' },
  purchased: { label: 'Tenant purchased, onboarding not started', detail: 'Claims & Legal bundle: 10 Claims + 4 Legal seats.' },
  running: { label: 'Tenant and carrier fully onboarded', detail: 'People, seats, pending and expired invitations in both workspaces.' },
};
function buy(platform, ws, draft, lines, cadence, contact, day) {
  for (const [sku, qty] of lines) { const r = setLine(draft.cart, platform.catalog.published, sku, qty); if (!r.ok) throw new Error(r.error); }
  setCadence(draft.cart, cadence);
  const s = openCheckout(draft, platform.catalog.published);
  return recordPayment({ platform, ws, draft, contact, now: T(day), result: { status: 'approved', ref: `SIM-APP-SCN${day}`, simulated: true } }).order;
}
function onboard(ws, org, people, readiness, day) {
  O.saveOrg(ws, org);
  for (const [name, email, type, seats, state] of people) {
    const { member: m } = L.addMember(ws, { name, email, type }, T(day));
    for (const [pid, role] of seats) L.assign(ws, m.id, pid, role);
    if (state !== 'draft') L.sendInvite(ws, m.id, T(day, 10));
    if (state === 'active') L.acceptInvite(ws, m.id, T(day, 12));
    if (state === 'expired') L.expireInvite(ws, m.id, T(day + 1));
  }
  ws.onboarding.inviteDecision = 'sent';
  Object.assign(ws.onboarding.readiness, readiness);
  for (const s of O.STEPS) for (const i of O.checklist(ws, s.id)) if (i.kind === 'confirm' && i.required) O.confirm(ws, s.id, i.id, true);
  O.complete(ws, T(day, 15));
}
export function build(name) {
  clock.fixed = T(13);
  try { return buildInner(name); } finally { clock.fixed = null; }
}
function buildInner(name) {
  const platform = createPlatform(T(1));
  const ws = { tenant: createWorkspace('tenant'), carrier: createWorkspace('carrier') };
  const draft = { tenant: createDraft('tenant'), carrier: createDraft('carrier') };
  SEED_LEADS.forEach((l, i) => createLead(platform, l, T(10 + i)));
  if (name !== 'fresh') buy(platform, ws.tenant, draft.tenant, [['VDX-BND-CL', { seats: { mod_claims: 10, mod_legal: 4 } }]], 'monthly', { name: 'Jordan Avery', email: 'jordan.avery@northwind.example.test', company: 'Northwind Risk Partners' }, 12);
  if (name === 'running') {
    onboard(ws.tenant, { orgName: 'Northwind Risk Partners', businessType: 'MGA / program administrator', workspaceName: 'Northwind Claims & Legal', workspaceSlug: 'northwind', adminName: 'Jordan Avery', adminEmail: 'jordan.avery@northwind.example.test', region: 'United States (East)' },
      [['Alex Chen', 'alex.chen@northwind.example.test', 'employee', [['mod_claims', 'Manager'], ['mod_legal', 'Contributor']], 'active'],
       ['Priya Raman', 'priya.raman@northwind.example.test', 'employee', [['mod_claims', 'Contributor']], 'active'],
       ['Marcus Bell', 'marcus.bell@northwind.example.test', 'employee', [['mod_claims', 'Contributor']], 'invited'],
       ['Elena Soto', 'elena.soto@lexpanel.example.test', 'external', [['mod_legal', 'Manager']], 'expired'],
       ['Tom Okafor', 'tom.okafor@northwind.example.test', 'contractor', [['mod_claims', 'Viewer']], 'draft']],
      { signIn: 'password', defaultRole: 'Viewer' }, 13);
    buy(platform, ws.carrier, draft.carrier, [['VDX-BND-CO', { seats: { mod_policy: 25, mod_claims: 40 } }], ['VDX-INS-ADV', { seats: { mod_insights: 6 } }]], 'annual', { name: 'Morgan Ellis', email: 'morgan.ellis@keystonemutual.example.test', company: 'Keystone Mutual (synthetic)' }, 14);
    onboard(ws.carrier, { orgName: 'Keystone Mutual (synthetic)', businessType: 'Admitted carrier', workspaceName: 'Keystone Operations', workspaceSlug: 'keystone-ops', adminName: 'Morgan Ellis', adminEmail: 'morgan.ellis@keystonemutual.example.test', region: 'United States (East)', lines: ['Commercial auto', 'Trucking / fleet'] },
      [['Sam Ortiz', 'sam.ortiz@keystonemutual.example.test', 'employee', [['mod_policy', 'Manager'], ['mod_claims', 'Viewer']], 'active'],
       ['Lena Fischer', 'lena.fischer@keystonemutual.example.test', 'employee', [['mod_claims', 'Manager'], ['mod_insights', 'Contributor']], 'active'],
       ['Noah Patel', 'noah.patel@keystonemutual.example.test', 'employee', [['mod_claims', 'Contributor']], 'invited']],
      { signIn: 'sso', defaultRole: 'Viewer', regions: ['Northeast', 'Midwest'], rollout: 'phased' }, 15);
  }
  return { platform, ws, draft };
}
export function loadScenario(name) {
  const s = build(name);
  resetAll();
  save('platform', s.platform); save('ws.tenant', s.ws.tenant); save('ws.carrier', s.ws.carrier); save('draft.tenant', s.draft.tenant); save('draft.carrier', s.draft.carrier);
}
