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
import { startSession, touchSession, markConverted } from '../models/cartSessions.js';

const T = (d, h = 9) => `2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`;
export const SCENARIOS = {
  fresh: { label: 'Fresh start', detail: 'Empty carts, no purchases. Seeded catalog, sample leads and two sample abandoned carts.' },
  purchased: { label: 'Tenant purchased, onboarding not started', detail: '12 Core user licences + Claims & Legal bundle (10 Claims, 4 Legal) + initial configuration.' },
  running: { label: 'Tenant and carrier fully onboarded', detail: 'People, seats, pending and expired invitations in both workspaces.' },
};
function buy(platform, ws, draft, lines, cadence, contact, day) {
  const cat = platform.catalog.published;
  startSession(platform, draft, { industry: draft.persona === 'carrier' ? 'Admitted carrier' : 'MGA / program administrator', companySize: draft.persona === 'carrier' ? '500–2,000' : '11–50', region: 'US — Northeast',
    useCase: draft.persona === 'carrier' ? 'Claims operating model change' : 'Better litigation oversight', timeline: 'this_quarter', budget: '5k_20k', decisionRole: 'decision_maker', ...contact, followUpConsent: true }, T(day, 8));
  for (const [sku, qty] of lines) { const r = setLine(draft.cart, cat, sku, qty); if (!r.ok) throw new Error(r.error); }
  setCadence(draft.cart, cadence);
  touchSession(platform, draft, cat, 'checkout', { entitlements: ws.entitlements }, T(day, 8));
  openCheckout(draft, cat, ws);
  const order = recordPayment({ platform, ws, draft, contact: draft.contact, now: T(day), result: { status: 'approved', ref: `SIM-APP-SCN${day}`, simulated: true } }).order;
  markConverted(platform, draft, order.id, T(day));
  return order;
}
/** Synthetic abandoned carts so the staff inbox has something to follow up on. */
function abandoned(platform, persona, contact, lines, stage, day, hour) {
  const d = { seq: 0, persona, cart: { lines: [], cadence: 'monthly' }, contact: {}, sessionId: null };
  const cat = platform.catalog.published;
  startSession(platform, d, contact, T(day, hour));
  for (const [sku, qty] of lines) setLine(d.cart, cat, sku, qty);
  touchSession(platform, d, cat, stage, {}, T(day, hour));
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
  abandoned(platform, 'tenant', { name: 'Riley Grant', email: 'riley.grant@harborline.example.test', company: 'Harborline MGA (synthetic)', phone: '+1 555 0142', jobTitle: 'Operations Director', followUpConsent: true,
    decisionRole: 'decision_maker', industry: 'MGA / program administrator', companySize: '11–50', region: 'US — Southeast', website: 'harborline.example.test', currentSystem: 'Spreadsheets and a legacy AMS',
    useCase: 'Replace spreadsheets', interests: ['Claims', 'Legal', 'Data migration'], estUsers: 8, budget: '1k_5k', timeline: 'this_month', notes: 'Needs litigation tracking live before Q1 renewals.', heardFrom: 'Referral or colleague' },
    [['VDX-CORE-USR', { seats: { mod_core: 8 } }], ['VDX-BND-CL', { seats: { mod_claims: 6, mod_legal: 3 } }], ['VDX-SVC-MIG', { units: 1 }]], 'checkout', 11, 15);
  abandoned(platform, 'carrier', { name: 'Avery Lin', email: 'avery.lin@summitre.example.test', company: 'Summit Mutual (synthetic)', followUpConsent: false,
    decisionRole: 'evaluator', industry: 'Admitted carrier', companySize: '100–500', region: 'US — Midwest', useCase: 'Modernize policy administration', interests: ['Policy', 'Claims'], estUsers: 40, budget: 'not_sure', timeline: 'six_months' },
    [['VDX-CORE-USR', { seats: { mod_core: 40 } }], ['VDX-BND-CO', { seats: { mod_policy: 20, mod_claims: 30 } }]], 'review', 12, 10);
  if (name !== 'fresh') buy(platform, ws.tenant, draft.tenant, [['VDX-CORE-USR', { seats: { mod_core: 12 } }], ['VDX-BND-CL', { seats: { mod_claims: 10, mod_legal: 4 } }], ['VDX-SVC-CFG', { units: 1 }]], 'monthly', { name: 'Jordan Avery', email: 'jordan.avery@northwind.example.test', company: 'Northwind Risk Partners' }, 12);
  if (name === 'running') {
    onboard(ws.tenant, { orgName: 'Northwind Risk Partners', businessType: 'MGA / program administrator', workspaceName: 'Northwind Claims & Legal', workspaceSlug: 'northwind', adminName: 'Jordan Avery', adminEmail: 'jordan.avery@northwind.example.test', region: 'United States (East)' },
      [['Alex Chen', 'alex.chen@northwind.example.test', 'employee', [['mod_claims', 'Manager'], ['mod_legal', 'Contributor']], 'active'],
       ['Priya Raman', 'priya.raman@northwind.example.test', 'employee', [['mod_claims', 'Contributor']], 'active'],
       ['Marcus Bell', 'marcus.bell@northwind.example.test', 'employee', [['mod_claims', 'Contributor']], 'invited'],
       ['Elena Soto', 'elena.soto@lexpanel.example.test', 'external', [['mod_legal', 'Manager']], 'expired'],
       ['Tom Okafor', 'tom.okafor@northwind.example.test', 'contractor', [['mod_claims', 'Viewer']], 'draft']],
      { signIn: 'password', defaultRole: 'Viewer' }, 13);
    buy(platform, ws.carrier, draft.carrier, [['VDX-CORE-USR', { seats: { mod_core: 60 } }], ['VDX-BND-CO', { metric: 'bundle_seat', bundleSeats: 65 }], ['VDX-INS-ADV', { seats: { mod_insights: 6 } }], ['VDX-ADD-PAY', {}], ['VDX-ADD-PORTAL', { units: 1 }], ['VDX-SVC-MIG', { units: 2 }], ['VDX-SVC-TRN', { units: 4 }]], 'annual', { name: 'Morgan Ellis', email: 'morgan.ellis@keystonemutual.example.test', company: 'Keystone Mutual (synthetic)' }, 14);
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
