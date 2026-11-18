// Model-level acceptance tests. Run: node tests/run.mjs
import assert from 'node:assert/strict';
import { useMemoryBackend, createDraft, save, load, resetAll, exportAll, importAll, SCHEMA } from '../services/storage.js';
useMemoryBackend();
import { createPlatform, saveProduct, setPrice, saveSku, publish, can, promoteScheduled } from '../models/platform.js';
import { createWorkspace } from '../models/workspace.js';
import { setLine, setCadence, quote, compareDemand, removeLine } from '../models/pricing.js';
import { openCheckout, recordPayment, previewAddSeats, completeAddSeats, reduceSeats } from '../models/orders.js';
import * as L from '../models/licensing.js';
import * as O from '../models/onboarding.js';
import { createLead, leadBrief } from '../models/leads.js';
import { validateCatalog, offersFor } from '../models/catalog.js';
import { toMinor, pctBps, toQty } from '../models/money.js';
import { build } from '../services/scenarios.js';
import { evaluate, gate, setConfirmation } from '../models/checklist.js';
import { recordUsage, usageEstimate, advanceService } from '../models/orders.js';
import { startSession, touchSession, sessionStatus, markConverted, updateFollowUp, hasContact, leadPriority } from '../models/cartSessions.js';

const results = [];
const platformTotal = (p) => p.orders[0].monthlyNetMinor;
const test = (n, name, fn) => { try { fn(); results.push([n, name, 'PASS']); } catch (e) { results.push([n, name, 'FAIL: ' + String(e.message).slice(0, 300)]); } };
const contact = { name: 'Test Buyer', email: 'buyer@example.test' };
const OK = { status: 'approved', ref: 'SIM-1' };
const CORE = (n = 20) => ['VDX-CORE-USR', { seats: { mod_core: n } }];
function purchased(persona = 'tenant', lines = [['VDX-BND-CL', { seats: { mod_claims: 5, mod_legal: 3 } }]], core = 20) {
  const platform = createPlatform(), ws = createWorkspace(persona), draft = createDraft(persona);
  for (const [s, q] of core ? [CORE(core), ...lines] : lines) assert.ok(setLine(draft.cart, platform.catalog.published, s, q).ok);
  openCheckout(draft, platform.catalog.published, ws);
  const { order } = recordPayment({ platform, ws, draft, result: OK, contact });
  return { platform, ws, draft, order };
}
const ORG = { orgName: 'Acme', businessType: 'Other', workspaceName: 'Acme', workspaceSlug: 'acme-ws', adminName: 'Ada Admin', adminEmail: 'ada@example.test', region: 'Canada' };

test(1, 'Admin-only setup consumes zero module seats', () => {
  const { ws } = purchased();
  assert.deepEqual(O.saveOrg(ws, ORG), {});
  assert.equal(L.totals(ws).admins, 1);
  assert.equal(L.totals(ws).seatsUsed, 0);
  for (const c of L.capacity(ws)) assert.equal(c.available, c.purchased);
});
test(2, 'One person in two modules uses two seats; no cross-module borrowing', () => {
  const { ws } = purchased(); // Legal 3, Claims 5 → use brief example with Legal full
  const alex = L.addMember(ws, { name: 'Alex', email: 'alex@example.test' }).member;
  L.assign(ws, alex.id, 'mod_legal'); L.assign(ws, alex.id, 'mod_claims');
  assert.equal(L.moduleCapacity(ws, 'mod_legal').reserved, 1);
  assert.equal(L.moduleCapacity(ws, 'mod_claims').reserved, 1);
  assert.equal(L.totals(ws).people, 1); assert.equal(L.totals(ws).seatsUsed, 2);
  for (const n of ['b', 'c']) L.assign(ws, L.addMember(ws, { name: n, email: `${n}@example.test` }).member.id, 'mod_legal');
  const extra = L.addMember(ws, { name: 'd', email: 'd@example.test' }).member;
  assert.throws(() => L.assign(ws, extra.id, 'mod_legal'), L.CapacityError);
  assert.equal(L.moduleCapacity(ws, 'mod_claims').available, 4); // spare Claims seats did not help
});
test(3, 'Bundle purchase keeps SKU identity and expands to module entitlements', () => {
  const { ws, order } = purchased();
  assert.equal(order.lines[1].skuId, 'VDX-BND-CL'); assert.equal(order.lines[1].skuType, 'bundle'); assert.equal(order.lines[1].licenseMetric, 'per_seat');
  assert.equal(ws.subscriptions[1].skuId, 'VDX-BND-CL');
  assert.equal(ws.entitlements.mod_claims.purchased, 5); assert.equal(ws.entitlements.mod_legal.purchased, 3);
  const f = purchased('tenant', [['VDX-BND-TEAM5', { packages: 2 }]]);
  assert.equal(f.ws.entitlements.mod_claims.purchased, 10); assert.equal(f.order.lines[1].packages, 2);
});
test(4, 'Mixed cart: overlap, quantities, cadence, rounding, invalid input', () => {
  const p = createPlatform(), cat = p.catalog.published, d = createDraft('tenant');
  setLine(d.cart, cat, 'VDX-BND-CL', { seats: { mod_claims: 10, mod_legal: 4 } });
  setLine(d.cart, cat, 'VDX-CLM-STD', { seats: { mod_claims: 3 } });
  let q = quote(cat, d.cart);
  assert.equal(q.conflicts.length, 0); assert.equal(q.capacity.find((c) => c.productId === 'mod_claims').seats, 13);
  assert.equal(q.monthlyNetMinor, 3780 * 10 + 5220 * 4 + 4200 * 3);
  setLine(d.cart, cat, 'VDX-CLM-ADV', { seats: { mod_claims: 2 } });
  q = quote(cat, d.cart); assert.equal(q.conflicts.length, 1); assert.equal(q.purchasable, false);
  assert.throws(() => openCheckout(d, cat));
  removeLine(d.cart, 'VDX-CLM-ADV');
  assert.equal(setLine(d.cart, cat, 'VDX-CLM-STD', { seats: { mod_claims: 3 } }).replaced, true); // no duplicate line
  assert.equal(d.cart.lines.length, 2);
  for (const bad of [0, -1, 1.5, NaN, '3', 501]) assert.equal(setLine(d.cart, cat, 'VDX-LGL-STD', { seats: { mod_legal: bad } }).ok, false);
  setCadence(d.cart, 'annual'); q = quote(cat, d.cart);
  assert.equal(q.smaMonthlyMinor, pctBps(q.monthlyNetMinor, 1500));
  assert.equal(q.periodGrossMinor, (q.monthlyNetMinor + q.smaMonthlyMinor) * 12);
  assert.equal(q.cadenceDiscountMinor, Math.round(q.periodGrossMinor * 0.1));
  assert.equal(q.totalDueMinor, q.subtotalMinor + pctBps(q.subtotalMinor, 825));
  assert.ok(Number.isInteger(q.totalDueMinor));
  assert.equal(toMinor('12.5'), 1250); assert.equal(toMinor('1e3'), null); assert.equal(toMinor('-4'), null); assert.equal(toQty('4.0'), null);
  assert.equal(pctBps(3333, 1000), 333); assert.equal(pctBps(3335, 1000), 334);
});
test(5, 'No roster/workspace details before payment; direct onboarding entry fails', () => {
  const d = createDraft('tenant'), ws = createWorkspace('tenant');
  assert.deepEqual(Object.keys(d).sort(), ['cart', 'chat', 'checkout', 'confirmations', 'contact', 'intake', 'lastOrderId', 'persona', 'savedQuotes', 'seq', 'ui', 'sessionId'].sort());
  assert.equal(O.canEnter(ws, 0).ok, false); assert.equal(O.canEnter(ws, 0).reason, 'locked');
  assert.throws(() => O.goTo(ws, 2)); assert.throws(() => O.saveOrg(ws, ORG));
  assert.equal(ws.members.length, 0);
});
test(6, 'Declined / cancelled / retried payment never duplicates entitlements', () => {
  const platform = createPlatform(), ws = createWorkspace('tenant'), draft = createDraft('tenant');
  setLine(draft.cart, platform.catalog.published, 'VDX-CLM-STD', { seats: { mod_claims: 4 } });
  assert.throws(() => openCheckout(draft, platform.catalog.published, ws), /user licences/); // module seats need platform user licences
  setLine(draft.cart, platform.catalog.published, 'VDX-CORE-USR', { seats: { mod_core: 4 } });
  const s = openCheckout(draft, platform.catalog.published, ws);
  assert.equal(recordPayment({ platform, ws, draft, result: { status: 'declined', ref: 'd' }, contact }).order, null);
  assert.equal(recordPayment({ platform, ws, draft, result: { status: 'cancelled', ref: 'c' }, contact }).order, null);
  assert.equal(ws.onboarding.unlocked, false); assert.equal(platform.orders.length, 0);
  assert.equal(openCheckout(draft, platform.catalog.published, ws).id, s.id); // retry reuses the session
  const a = recordPayment({ platform, ws, draft, result: OK, contact });
  const b = recordPayment({ platform, ws, draft, result: OK, contact });
  assert.equal(b.duplicate, true); assert.equal(a.order.id, b.order.id);
  assert.equal(platform.orders.length, 1); assert.equal(ws.entitlements.mod_claims.purchased, 4);
  assert.equal(platform.billingEvents.length, 3);
});
test(7, 'Allocation cannot exceed capacity; reservations are not double-counted', () => {
  const { ws } = purchased();
  const ids = ['a', 'b', 'c'].map((n) => L.addMember(ws, { name: n, email: `${n}@example.test` }).member.id);
  ids.forEach((id) => L.assign(ws, id, 'mod_legal'));
  let c = L.moduleCapacity(ws, 'mod_legal'); assert.deepEqual([c.reserved, c.assigned, c.available], [3, 0, 0]);
  L.sendInvite(ws, ids[0]); c = L.moduleCapacity(ws, 'mod_legal'); assert.deepEqual([c.reserved, c.assigned, c.available], [3, 0, 0]);
  L.acceptInvite(ws, ids[0]); c = L.moduleCapacity(ws, 'mod_legal'); assert.deepEqual([c.reserved, c.assigned, c.available], [2, 1, 0]);
  assert.equal(c.reserved + c.assigned + c.available, c.purchased);
  assert.throws(() => L.assign(ws, ids[0], 'mod_legal')); // duplicate seat
});
test(8, 'Contact edits keep stable identity and independent module roles', () => {
  const { ws } = purchased();
  const m = L.addMember(ws, { name: 'Sam', email: 'sam@example.test' }).member;
  L.assign(ws, m.id, 'mod_claims', 'Manager'); L.assign(ws, m.id, 'mod_legal', 'Viewer');
  L.updateMember(ws, m.id, { email: 'sam.new@example.test', name: 'Samira' });
  assert.equal(L.member(ws, m.id).email, 'sam.new@example.test');
  assert.deepEqual(L.seatsOf(ws, m.id).map((a) => a.role), ['Manager', 'Viewer']);
  L.setRole(ws, m.id, 'mod_legal', 'Contributor');
  assert.equal(L.seatsOf(ws, m.id)[0].role, 'Manager');
  assert.equal(L.addMember(ws, { name: 'Dup', email: 'SAM.NEW@example.test' }).reused, true); // membership reused, not duplicated
});
test(9, 'Required checklist items gate, invalidate on edit; optional do not block', () => {
  const { ws } = purchased();
  O.saveOrg(ws, ORG);
  assert.equal(O.stepGate(ws, 'workspace').ok, false);
  O.confirm(ws, 'workspace', 'admin-free', true);
  const g = O.stepGate(ws, 'workspace'); assert.equal(g.ok, true); assert.equal(g.skipped.length, 1); // region review skipped, not blocking
  assert.throws(() => O.goTo(ws, 2)); // people step not confirmed
  O.confirm(ws, 'people', 'alloc-reviewed', true); assert.equal(O.stepGate(ws, 'people').ok, true);
  const m = L.addMember(ws, { name: 'New', email: 'new@example.test' }).member; L.assign(ws, m.id, 'mod_claims');
  const item = O.checklist(ws, 'people').find((i) => i.id === 'alloc-reviewed');
  assert.equal(item.done, false); assert.equal(item.stale, true);
  O.saveOrg(ws, { adminEmail: 'other@example.test' });
  assert.equal(O.stepGate(ws, 'workspace').ok, false); // admin edit invalidated confirmation
});
test(10, 'Tenant and carrier drafts, workspaces and lead contexts stay isolated', () => {
  resetAll();
  const dt = load('draft.tenant'), dc = load('draft.carrier'), p = load('platform');
  setLine(dt.cart, p.catalog.published, 'VDX-CLM-STD', { seats: { mod_claims: 2 } }); save('draft.tenant', dt);
  assert.equal(load('draft.carrier').cart.lines.length, 0); assert.equal(load('draft.tenant').cart.lines.length, 1);
  assert.equal(setLine(dt.cart, p.catalog.published, 'VDX-BND-CO', { seats: { mod_policy: 1, mod_claims: 1 } }).ok, true); // model allows; storefront filters by audience:
  assert.equal(offersFor(p.catalog.published, 'tenant').some((s) => s.id === 'VDX-BND-CO'), false);
  assert.equal(offersFor(p.catalog.published, 'carrier').some((s) => s.id === 'VDX-BND-TEAM5'), false);
  const before = JSON.stringify(dc.cart);
  const lead = createLead(p, { persona: 'carrier', email: 'x@example.test', consent: true, followUp: 'email', source: 'intake' });
  assert.equal(lead.persona, 'carrier'); assert.equal(JSON.stringify(dc.cart), before);
});
test(11, 'Invitation accept / expire / resend / revoke and seat release', () => {
  const { ws } = purchased();
  const m = L.addMember(ws, { name: 'Ivy', email: 'ivy@example.test' }).member;
  L.assign(ws, m.id, 'mod_claims'); L.sendInvite(ws, m.id); L.expireInvite(ws, m.id);
  assert.equal(L.member(ws, m.id).status, 'expired'); assert.equal(L.moduleCapacity(ws, 'mod_claims').reserved, 1); // held
  L.sendInvite(ws, m.id); assert.equal(L.member(ws, m.id).invite.count, 2); assert.equal(L.moduleCapacity(ws, 'mod_claims').reserved, 1);
  L.acceptInvite(ws, m.id); L.suspend(ws, m.id); assert.equal(L.moduleCapacity(ws, 'mod_claims').assigned, 1); // suspended keeps seat
  L.reinstate(ws, m.id);
  assert.equal(L.revoke(ws, m.id), 1); assert.equal(L.moduleCapacity(ws, 'mod_claims').available, 5);
  assert.throws(() => L.acceptInvite(ws, m.id));
});
test(12, 'More seats need an explicit paid step; removing access never changes billing', () => {
  const { platform, ws } = purchased();
  const m = L.addMember(ws, { name: 'Bo', email: 'bo@example.test' }).member; L.assign(ws, m.id, 'mod_claims');
  const pv = previewAddSeats(platform.catalog.published, ws, 'mod_claims', 2);
  assert.equal(ws.entitlements.mod_claims.purchased, 5); // preview changed nothing
  assert.equal(pv.quote.monthlyNetMinor, 8400);
  const session = { id: 'add_1', productId: 'mod_claims', seats: 2 };
  completeAddSeats({ platform, ws, session, result: { status: 'declined', ref: 'x' } });
  assert.equal(ws.entitlements.mod_claims.purchased, 5);
  completeAddSeats({ platform, ws, session, result: OK }); completeAddSeats({ platform, ws, session, result: OK });
  assert.equal(ws.entitlements.mod_claims.purchased, 7);
  L.unassign(ws, m.id, 'mod_claims'); assert.equal(ws.entitlements.mod_claims.purchased, 7); assert.equal(ws.subscriptions.length, 3);
  L.assign(ws, m.id, 'mod_claims');
  assert.throws(() => reduceSeats({ platform, ws, productId: 'mod_claims', newCount: 0, occupied: 1 }));
  reduceSeats({ platform, ws, productId: 'mod_claims', newCount: 3, occupied: 1 }); assert.equal(ws.entitlements.mod_claims.purchased, 3);
});
test(13, 'Module visibility / enablement never changes purchased capacity', () => {
  const { ws } = purchased();
  L.setModuleFlag(ws, 'mod_legal', 'enabled', false); L.setModuleFlag(ws, 'mod_legal', 'visible', false);
  assert.equal(ws.entitlements.mod_legal.purchased, 3); assert.equal(L.moduleCapacity(ws, 'mod_legal').available, 3);
});
test(14, 'Leads need contact permission and never claim delivery or bookings', () => {
  const p = createPlatform();
  assert.throws(() => createLead(p, { email: 'a@example.test', followUp: 'demo', consent: false }));
  assert.throws(() => createLead(p, { email: 'nope', followUp: 'demo', consent: true }));
  const l = createLead(p, { email: 'a@example.test', followUp: 'demo', consent: true, source: 'chat' });
  assert.match(leadBrief(l), /No meeting is booked and no message has been sent/);
  assert.equal(l.status, 'new');
});
test(15, 'Reload, reset, export and import validation', () => {
  resetAll();
  const d = load('draft.tenant'), p = load('platform');
  setLine(d.cart, p.catalog.published, 'VDX-LGL-STD', { seats: { mod_legal: 7 } }); save('draft.tenant', d);
  assert.equal(load('draft.tenant').cart.lines[0].seats.mod_legal, 7); // survives reload
  const dump = JSON.parse(JSON.stringify(exportAll()));
  resetAll(); assert.equal(load('draft.tenant').cart.lines.length, 0);
  assert.equal(importAll({ nope: 1 }).ok, false); assert.equal(importAll({ ...dump, schema: SCHEMA - 1 }).ok, false);
  assert.equal(importAll({ ...dump, data: { ...dump.data, 'ws.tenant': { members: 'x' } } }).ok, false);
  assert.equal(load('draft.tenant').cart.lines.length, 0); // failed imports wrote nothing
  assert.equal(importAll(dump).ok, true); assert.equal(load('draft.tenant').cart.lines[0].seats.mod_legal, 7);
});
test(17, 'VeriDex Admin: create product, prices, bundle SKU, publish → purchaser sees it', () => {
  const p = createPlatform();
  const prod = saveProduct(p, { name: 'Subrogation', summary: 'Recoveries', personas: ['tenant'], status: 'active', kind: 'module', metrics: [{ key: 'per_seat', enabled: true }], tiers: [{ name: 'Standard', features: ['Recovery queue'] }] });
  assert.ok(validateCatalog(p.catalog.draft).some((i) => i.level === 'error')); // price missing
  assert.throws(() => publish(p));
  setPrice(p, `${prod.id}:${prod.tiers[0].id}:per_seat`, 3100);
  saveSku(p, { id: 'VDX-SUBR-STD', licenseMetrics: ['per_seat'], defaultMetric: 'per_seat', chargeType: 'recurring', type: 'standalone', name: 'Subrogation Standard', audience: ['tenant'], description: '', status: 'published', components: [{ productId: prod.id, tierId: prod.tiers[0].id }], quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps: 0 });
  saveSku(p, { id: 'VDX-BND-CS', licenseMetrics: ['per_seat'], defaultMetric: 'per_seat', chargeType: 'recurring', type: 'bundle', name: 'Claims & Subrogation', audience: ['tenant'], description: '', status: 'published', components: [{ productId: 'mod_claims', tierId: 'standard' }, { productId: prod.id, tierId: prod.tiers[0].id }], quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps: 1500 });
  assert.equal(offersFor(p.catalog.published, 'tenant').some((s) => s.id === 'VDX-BND-CS'), false); // draft is not live
  p.role = 'catalog_manager'; assert.equal(can(p, 'catalog.publish'), false); assert.throws(() => publish(p));
  p.role = 'support_readonly'; assert.throws(() => setPrice(p, 'mod_claims:standard:per_seat', 1));
  p.role = 'pricing_approver'; assert.equal(publish(p).version, 2);
  assert.equal(offersFor(p.catalog.published, 'tenant').some((s) => s.id === 'VDX-BND-CS'), true);
  const ws = createWorkspace('tenant'), d = createDraft('tenant');
  setLine(d.cart, p.catalog.published, 'VDX-BND-CS', { seats: { mod_claims: 6, [prod.id]: 2 } }); setLine(d.cart, p.catalog.published, 'VDX-CORE-USR', { seats: { mod_core: 8 } });
  openCheckout(d, p.catalog.published, ws); recordPayment({ platform: p, ws, draft: d, result: OK, contact });
  assert.equal(ws.entitlements[prod.id].purchased, 2); assert.equal(ws.entitlements.mod_claims.purchased, 6);
  assert.equal(platformTotal(p), 6 * 3570 + 2 * 2635 + 8 * 1500);
});
test(18, 'Unequal demand 10 + 4: standalone vs bundle totals and capacity', () => {
  const cat = createPlatform().catalog.published;
  const o = Object.fromEntries(compareDemand(cat, 'tenant', { mod_claims: 10, mod_legal: 4 }).map((x) => [x.name, x]));
  assert.equal(o['Individual modules'].monthlyMinor, 10 * 4200 + 4 * 5800); // $652.00
  assert.equal(o['Claims & Legal'].monthlyMinor, 10 * 3780 + 4 * 5220); // $586.80
  assert.deepEqual(o['Claims & Legal'].parts.map((p) => p.seats), [10, 4]); assert.equal(o['Claims & Legal'].excessSeats, 0);
  assert.equal(o['Team Pack 5+5'].packages, 2); assert.equal(o['Team Pack 5+5'].monthlyMinor, 84000); assert.equal(o['Team Pack 5+5'].excessSeats, 6); // disclosed
  const { ws } = purchased('tenant', [['VDX-BND-CL', { seats: { mod_claims: 10, mod_legal: 4 } }]]);
  assert.equal(ws.entitlements.mod_claims.purchased, 10); assert.equal(ws.entitlements.mod_legal.purchased, 4);
});
test(19, 'Tenant capacity matches the order; later price edits do not rewrite it', () => {
  const { platform, ws, order } = purchased('tenant', [['VDX-BND-CL', { seats: { mod_claims: 10, mod_legal: 4 } }]]);
  const before = JSON.stringify(order);
  setPrice(platform, 'mod_claims:standard:per_seat', 9900); publish(platform);
  assert.equal(JSON.stringify(platform.orders[0]), before);
  assert.equal(ws.subscriptions[1].components[0].unitNetMinor, 3780); assert.equal(ws.subscriptions[1].catalogVersion, 1);
  assert.equal(L.seatModules(ws).map((c) => c.purchased).join(), '10,4'); assert.equal(L.userLicences(ws).purchased, 20);
  const d = createDraft('tenant'); setLine(d.cart, platform.catalog.published, 'VDX-CLM-STD', { seats: { mod_claims: 1 } });
  assert.equal(quote(platform.catalog.published, d.cart, { entitlements: ws.entitlements }).monthlyNetMinor, 9900); // new purchases use the new price
  platform.catalog.draft.settings.taxBps = 900; publish(platform, { effectiveAt: '2999-01-01T00:00:00.000Z' });
  assert.equal(platform.catalog.published.settings.taxBps, 825); assert.equal(promoteScheduled(platform, '2999-01-02T00:00:00.000Z'), true);
  assert.equal(platform.catalog.published.settings.taxBps, 900);
});
test(20, 'Platform and tenant scopes are distinct', () => {
  const { platform, ws } = purchased();
  assert.equal('catalog' in ws, false); assert.equal('members' in platform, false);
  assert.equal(can({ role: 'support_readonly' }, 'catalog.edit'), false); assert.equal(can({ role: 'platform_admin' }, 'catalog.publish'), true);
});
test('M1', 'Several licence metrics per product; admin enables/disables; custom metric must be marked new/custom', () => {
  const p = createPlatform(), cat = p.catalog.draft;
  for (const k of cat.skus) assert.ok(k.licenseMetrics.length >= 1, k.id);
  assert.deepEqual(cat.skus.find((k) => k.id === 'VDX-CLM-STD').licenseMetrics, ['per_seat', 'per_module', 'per_usage']);
  assert.deepEqual(validateCatalog(cat).filter((i) => i.level === 'error'), []);
  // Admin disables "per module" on Claims → the Claims SKUs stop offering it.
  const claims = cat.products.find((x) => x.id === 'mod_claims');
  saveProduct(p, { ...claims, metrics: claims.metrics.map((m) => (m.key === 'per_module' ? { ...m, enabled: false } : m)) });
  assert.deepEqual(cat.skus.find((k) => k.id === 'VDX-CLM-STD').licenseMetrics, ['per_seat', 'per_usage']);
  // A metric that does not apply to the product kind is rejected.
  cat.products.find((x) => x.id === 'mod_portal').metrics.push({ key: 'per_module', enabled: true });
  assert.ok(validateCatalog(cat).some((i) => i.level === 'error' && /does not apply/.test(i.msg)));
  cat.products.find((x) => x.id === 'mod_portal').metrics.pop();
  // Custom metric: refused unless explicitly marked new/custom; accepted when marked, then needs a price.
  const legal = cat.products.find((x) => x.id === 'mod_legal');
  assert.throws(() => saveProduct(p, { ...legal, metrics: [...legal.metrics, { key: 'custom_x', name: 'Per lawsuit', unitLabel: 'lawsuit', basis: 'quantity', enabled: true }] }), /new\/custom/i);
  saveProduct(p, { ...legal, metrics: [...legal.metrics, { isCustom: true, name: 'Per lawsuit', unitLabel: 'lawsuit', basis: 'quantity', enabled: true }] });
  const cm = legal.metrics.find((m) => m.isCustom);
  assert.equal(cm.key, 'custom_per_lawsuit');
  assert.ok(validateCatalog(cat).some((i) => /Missing or invalid price for Per lawsuit/.test(i.msg)));
  for (const t of legal.tiers) setPrice(p, `mod_legal:${t.id}:custom_per_lawsuit`, 500);
  const std = cat.skus.find((k) => k.id === 'VDX-LGL-STD'); std.licenseMetrics.push('custom_per_lawsuit');
  assert.deepEqual(validateCatalog(cat).filter((i) => i.level === 'error'), []);
  // Buyer picks a metric per line; the chosen metric is priced and stored.
  const d = createDraft('tenant'); setLine(d.cart, cat, 'VDX-LGL-STD', { metric: 'custom_per_lawsuit', units: 30 }); setLine(d.cart, cat, 'VDX-CORE-USR', { seats: { mod_core: 3 } });
  const q = quote(cat, d.cart);
  assert.equal(q.lines[0].metricLabel, 'Per lawsuit'); assert.equal(q.lines[0].isCustomMetric, true); assert.equal(q.lines[0].monthlyNetMinor, 15000);
  assert.equal(setLine(d.cart, cat, 'VDX-LGL-STD', { metric: 'per_usage' }).ok, false); // not enabled on Legal
});
test('M2', 'Per-user licences: first module seat takes one; admins take none; blocks at capacity', () => {
  const { ws } = purchased('tenant', [['VDX-BND-CL', { seats: { mod_claims: 5, mod_legal: 3 } }]], 2);
  O.saveOrg(ws, ORG);
  assert.equal(L.userLicences(ws).available, 2); // admin uses no user licence
  const a = L.addMember(ws, { name: 'A', email: 'a@example.test' }).member, b = L.addMember(ws, { name: 'B', email: 'b@example.test' }).member, c = L.addMember(ws, { name: 'C', email: 'c@example.test' }).member;
  L.assign(ws, a.id, 'mod_claims'); L.assign(ws, a.id, 'mod_legal');
  assert.equal(L.userLicences(ws).reserved, 1); // one person, two module seats, one user licence
  L.assign(ws, b.id, 'mod_claims');
  assert.throws(() => L.assign(ws, c.id, 'mod_claims'), L.CapacityError); // Claims has room, user licences do not
  assert.equal(L.moduleCapacity(ws, 'mod_claims').available, 3);
  L.revoke(ws, b.id); L.assign(ws, c.id, 'mod_claims'); assert.equal(L.userLicences(ws).available, 0);
  assert.throws(() => L.assign(ws, c.id, 'mod_core'));
});
test('M3', 'Flat and usage add-ons are workspace-wide, cannot be bought twice; usage billed in arrears', () => {
  const { platform, ws, order } = purchased('tenant', [['VDX-ADD-PORTAL', { units: 1 }], ['VDX-ADD-PAY', {}]], 0);
  assert.equal(ws.entitlements.mod_portal.purchased, null); assert.equal(ws.entitlements.mod_pay.licenseMetric, 'per_usage');
  assert.equal(order.monthlyNetMinor, 25000); // usage adds nothing up front
  assert.equal(order.usageTerms[0].rateMinor, 75);
  const d = createDraft('tenant'); setLine(d.cart, platform.catalog.published, 'VDX-ADD-PORTAL', { units: 1 });
  const q = quote(platform.catalog.published, d.cart, { entitlements: ws.entitlements });
  assert.equal(q.purchasable, false); assert.match(q.errors[0], /already active/);
  recordUsage(ws, 'mod_pay', 140); assert.deepEqual(usageEstimate(ws.entitlements.mod_pay.usage), { billable: 40, amountMinor: 3000 });
  assert.throws(() => L.assign(ws, L.addMember(ws, { name: 'Z', email: 'z@example.test' }).member.id, 'mod_portal'));
});
test('M4', 'SMA on recurring licence fees only; one-time services: once, no SMA, no annual discount', () => {
  const cat = createPlatform().catalog.published, d = createDraft('tenant');
  setLine(d.cart, cat, 'VDX-CORE-USR', { seats: { mod_core: 10 } }); setLine(d.cart, cat, 'VDX-CLM-STD', { seats: { mod_claims: 10 } });
  setLine(d.cart, cat, 'VDX-SVC-TRN', { units: 3 }); setLine(d.cart, cat, 'VDX-ADD-PAY', {});
  setCadence(d.cart, 'annual');
  const q = quote(cat, d.cart);
  assert.equal(q.monthlyNetMinor, 10 * 1500 + 10 * 4200);
  assert.equal(q.smaMonthlyMinor, pctBps(57000, 1500));
  assert.equal(q.oneTimeMinor, 3 * 60000);
  assert.equal(q.recurringPeriodMinor, (57000 + 8550) * 12 - pctBps((57000 + 8550) * 12, 1000));
  assert.equal(q.subtotalMinor, q.recurringPeriodMinor + 180000);
  const { ws } = purchased('tenant', [['VDX-SVC-MIG', { units: 2 }], ['VDX-CLM-STD', { seats: { mod_claims: 2 } }]], 2);
  assert.equal(ws.services.length, 1); assert.equal(ws.subscriptions.some((x) => x.skuId === 'VDX-SVC-MIG'), false);
  advanceService(ws, ws.services[0].id); assert.equal(ws.services[0].status, 'scheduled');
  assert.equal(setLine(d.cart, cat, 'VDX-SVC-TRN', { units: 21 }).ok, false);
});
test('M5', 'Contact captured before shopping; carts tracked; abandoned after idle; consent respected', () => {
  const p = createPlatform(), d = createDraft('tenant'), cat = p.catalog.published;
  assert.equal(hasContact(d), false);
  assert.throws(() => startSession(p, d, { name: 'Kim', email: 'kim@example.test', company: 'Co' }), /industry/); // business and requirement details are required
  const LEAD = { name: 'Kim Lee', email: 'kim@example.test', company: 'Co', industry: 'Insurance agency', companySize: '11–50', region: 'US — West', useCase: 'Replace spreadsheets', timeline: 'this_month', budget: '1k_5k', decisionRole: 'decision_maker', estUsers: '12', interests: ['Claims'], notes: 'Go live in January' };
  assert.throws(() => startSession(p, d, { ...LEAD, estUsers: '2.5' }), /whole number/);
  startSession(p, d, { ...LEAD, followUpConsent: false }, '2026-11-17T09:00:00.000Z');
  assert.equal(d.contact.estUsers, 12); assert.equal(leadPriority(d.contact).label, 'Hot');
  assert.equal(hasContact(d), true); assert.equal(p.cartSessions.length, 1); assert.equal(p.cartSessions[0].followUp.status, 'do_not_contact');
  setLine(d.cart, cat, 'VDX-CORE-USR', { seats: { mod_core: 3 } }); touchSession(p, d, cat, 'review', {}, '2026-11-17T09:05:00.000Z');
  const s = p.cartSessions[0];
  assert.equal(s.lines.length, 1); assert.equal(s.stage, 'review'); assert.ok(s.dueTodayMinor > 0);
  assert.equal(sessionStatus(s, 60, '2026-11-17T09:30:00.000Z'), 'active'); assert.equal(sessionStatus(s, 60, '2026-11-17T10:06:00.000Z'), 'abandoned');
  assert.throws(() => updateFollowUp(p, s.id, { status: 'contacted' }), /permission/);
  startSession(p, d, { ...LEAD, followUpConsent: true }); assert.equal(s.followUp.status, 'new'); assert.equal(p.cartSessions.length, 1);
  markConverted(p, d, 'ord_x'); assert.equal(sessionStatus(s, 0), 'converted'); assert.equal(d.sessionId, null);
});
test('B1', 'Bundle seat pool: each person–module assignment uses one seat; blocks at pool capacity; buy more extends the pool', () => {
  const { platform, ws, order } = purchased('tenant', [['VDX-BND-SUITE', { metric: 'bundle_seat', bundleSeats: 4 }]], 10);
  assert.equal(order.lines[1].licenseMetric, 'bundle_seat'); assert.equal(order.lines[1].bundleSeats, 4); assert.equal(order.lines[1].monthlyNetMinor, 4 * 3500);
  assert.equal(ws.pools['VDX-BND-SUITE'].purchased, 4); assert.equal(ws.entitlements.mod_claims.licenseMetric, 'bundle_seat');
  const vikram = L.addMember(ws, { name: 'Vikram', email: 'vikram@example.test' }).member;
  L.assign(ws, vikram.id, 'mod_policy'); L.assign(ws, vikram.id, 'mod_claims'); L.assign(ws, vikram.id, 'mod_legal');
  const pool = L.moduleCapacity(ws, 'pool:VDX-BND-SUITE');
  assert.deepEqual([pool.reserved, pool.assigned, pool.available], [3, 0, 1]); // Vikram in 3 modules = 3 bundle seats
  assert.equal(L.userLicences(ws).reserved, 1); // but only one user licence
  const ann = L.addMember(ws, { name: 'Ann', email: 'ann@example.test' }).member;
  L.assign(ws, ann.id, 'mod_insights');
  assert.throws(() => L.assign(ws, ann.id, 'mod_claims'), L.CapacityError); // pool full
  L.unassign(ws, vikram.id, 'mod_legal'); L.assign(ws, ann.id, 'mod_claims'); // freeing one seat lets another assignment in
  assert.equal(L.moduleCapacity(ws, 'pool:VDX-BND-SUITE').available, 0);
  const pv = previewAddSeats(platform.catalog.published, ws, 'pool:VDX-BND-SUITE', 6);
  assert.equal(pv.quote.monthlyNetMinor, 6 * 3500);
  completeAddSeats({ platform, ws, session: { id: 'add_pool', productId: 'pool:VDX-BND-SUITE', seats: 6 }, result: OK });
  assert.equal(ws.pools['VDX-BND-SUITE'].purchased, 10);
  assert.throws(() => reduceSeats({ platform, ws, productId: 'pool:VDX-BND-SUITE', newCount: 3, occupied: 4 }));
  const t = L.totals(ws); assert.equal(t.seatsPurchased, 10); assert.equal(t.seatsUsed, 4);
});
test('B2', 'Seat counts validated; one module cannot be licensed two ways; pool needs ≥ min seats', () => {
  const cat = createPlatform().catalog.published, d = createDraft('tenant');
  for (const bad of [0, 1, -3, 2.5, '4']) assert.equal(setLine(d.cart, cat, 'VDX-BND-CL', { metric: 'bundle_seat', bundleSeats: bad }).ok, false);
  assert.equal(setLine(d.cart, cat, 'VDX-BND-TEAM5', { metric: 'bundle_seat', bundleSeats: 5 }).ok, false); // fixed pack has no pool option
  setLine(d.cart, cat, 'VDX-BND-CL', { metric: 'bundle_seat', bundleSeats: 14 }); setLine(d.cart, cat, 'VDX-CLM-STD', { metric: 'per_seat', seats: { mod_claims: 2 } });
  setLine(d.cart, cat, 'VDX-CORE-USR', { seats: { mod_core: 10 } });
  let q = quote(cat, d.cart);
  assert.equal(q.conflicts.length, 1); assert.equal(q.purchasable, false); // Claims in a pool and per seat
  removeLine(d.cart, 'VDX-CLM-STD'); setLine(d.cart, cat, 'VDX-POL-STD', { metric: 'per_module' });
  q = quote(cat, d.cart); assert.equal(q.purchasable, true); assert.equal(q.pools[0].seats, 14); assert.equal(q.access[0].metricLabel, 'Per module');
  const opts = compareDemand(cat, 'tenant', { mod_claims: 10, mod_legal: 4 });
  const pool = opts.find((o) => o.kind === 'pool' && o.skuId === 'VDX-BND-CL');
  assert.equal(pool.bundleSeats, 14); assert.equal(pool.monthlyMinor, 14 * 4600);
  // A held per-seat module cannot be re-bought as part of a pool.
  const { ws } = purchased('tenant', [['VDX-CLM-STD', { seats: { mod_claims: 2 } }]], 5), d2 = createDraft('tenant');
  setLine(d2.cart, cat, 'VDX-BND-CL', { metric: 'bundle_seat', bundleSeats: 6 });
  assert.match(quote(cat, d2.cart, { entitlements: ws.entitlements }).errors[0], /already licensed/);
});
test('S', 'Demo scenarios build deterministically and respect every capacity rule', () => {
  const a = build('running'), b = build('running');
  assert.equal(JSON.stringify(a.ws), JSON.stringify(b.ws));
  for (const w of Object.values(a.ws)) for (const c of L.capacity(w).filter((x) => x.purchased != null)) { assert.ok(c.available >= 0); assert.equal(c.reserved + c.assigned + c.available, c.purchased); }
  assert.equal(L.moduleCapacity(a.ws.tenant, 'mod_claims').purchased, 10);
  assert.equal(a.ws.tenant.onboarding.completedAt != null, true);
});
test('C', 'Generic checklist engine: stale confirmations', () => {
  const defs = [{ id: 'x', kind: 'confirm', required: true, covers: (c) => c.v }, { id: 'y', kind: 'auto', required: false, check: () => false }];
  const conf = {}, ctx = { v: 1 };
  setConfirmation(defs, ctx, conf, 'x', true); assert.equal(gate(evaluate(defs, ctx, conf)).ok, true);
  ctx.v = 2; const items = evaluate(defs, ctx, conf); assert.equal(items[0].stale, true); assert.equal(gate(items).ok, false);
});
let fail = 0;
for (const [n, name, r] of results) { if (r !== 'PASS') fail++; console.log(`${r === 'PASS' ? '✔' : '✘'} [${n}] ${name}${r === 'PASS' ? '' : ' — ' + r}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
