// VeriDex Admin controller (platform scope). All mutations go through models/platform.js, which enforces platform roles.
import { loadState, mount, toast, html, openDialog, confirmDialog } from './base.js';
import { platformAdmin, productForm, skuForm, TABS } from '../views/templates/platformAdmin.js';
import { alert } from '../views/templates/components.js';
import * as P from '../models/platform.js';
import { validateCatalog, product, APPLICABLE } from '../models/catalog.js';
import { compareDemand } from '../models/pricing.js';
import { capacity, liveMembers } from '../models/licensing.js';
import { toMinor, toBps, toQty } from '../models/money.js';
import { load } from '../services/storage.js';

const S = loadState('tenant'); // platform aggregate is shared; workspaces are read only for commercial facts
const local = { qp: { persona: 'tenant', demand: { mod_claims: 10, mod_legal: 4 } } };
const tab = () => (TABS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
const pf = () => S.platform;
function customers() {
  return ['tenant', 'carrier'].map((p) => { const ws = load(`ws.${p}`); const first = pf().orders.find((o) => o.id === ws.orders[0]);
    return { persona: p, name: first?.contact?.company || ws.onboarding.org.orgName || `${p === 'carrier' ? 'Carrier' : 'Tenant'} demo workspace`, contact: first?.contact, subs: ws.subscriptions, cap: capacity(ws), people: liveMembers(ws).length, onboarded: !!ws.onboarding.completedAt, leads: pf().leads.filter((l) => l.persona === p).length }; });
}
const view = () => platformAdmin({ platform: pf(), tab: tab(), changes: P.draftChanges(pf()), issues: validateCatalog(pf().catalog.draft), canEdit: P.can(pf(), 'catalog.edit'), canPublish: P.can(pf(), 'catalog.publish'),
  customers: tab() === 'customers' ? customers() : [], options: compareDemand(pf().catalog.draft, local.qp.persona, local.qp.demand), ...local });
const commit = () => { S.save(); app.refresh(); };

/** Read the metric editor: standard metrics on/off with their unit settings, then custom metrics (only accepted when ticked “New / custom”). */
function readMetrics(fd, p) {
  const kind = String(fd.get('pf-kind') || p.kind || 'module');
  const out = [];
  for (const k of ['per_seat', 'per_module', 'per_usage', 'flat']) {
    if (!APPLICABLE[kind].includes(k)) continue;
    const m = { key: k, enabled: fd.get(`pm-${k}`) === 'on' };
    if (k === 'per_usage') { m.unitLabel = String(fd.get('pm-per_usage-unit') || '').trim() || 'unit'; const inc = toQty(fd.get('pm-per_usage-incl') || '0'); if (inc == null) throw new Error('Per usage: included units must be a whole number.'); m.includedUnits = inc; }
    if (k === 'flat') { m.unitLabel = String(fd.get('pm-flat-unit') || '').trim() || 'workspace'; const mx = toQty(fd.get('pm-flat-max') || '1'); if (!mx) throw new Error('Flat fee: maximum quantity must be a whole number of 1 or more.'); m.min = 1; m.max = mx; }
    out.push(m);
  }
  for (let i = 0; fd.has(`cm-name-${i}`); i++) {
    const name = String(fd.get(`cm-name-${i}`) || '').trim();
    if (!name) continue;
    const isNew = fd.get(`cm-new-${i}`) === 'on';
    const basis = String(fd.get(`cm-basis-${i}`)), inc = toQty(fd.get(`cm-incl-${i}`) || '0'), mx = toQty(fd.get(`cm-max-${i}`) || '');
    if (!isNew) throw new Error(`“${name}” is not a standard metric. Tick “New / custom metric” to add it, or clear its name.`);
    if (!String(fd.get(`cm-unit-${i}`) || '').trim()) throw new Error(`“${name}”: name the unit, e.g. vehicle.`);
    out.push({ key: String(fd.get(`cm-key-${i}`) || '') || undefined, isCustom: true, name, unitLabel: String(fd.get(`cm-unit-${i}`)).trim(), basis, enabled: fd.get(`cm-on-${i}`) === 'on',
      includedUnits: basis === 'usage' ? inc ?? 0 : undefined, min: 1, max: basis === 'usage' ? undefined : mx || (basis === 'fixed' ? 1 : 100000) });
  }
  if (!out.some((m) => m.enabled)) throw new Error('Enable at least one licence metric.');
  // Keep standard metrics that do not apply to this kind (disabled) so switching kind back does not lose settings.
  for (const m of p.metrics || []) if (!m.isCustom && !out.some((x) => x.key === m.key)) out.push({ ...m, enabled: false });
  return out;
}
async function editProduct(p) {
  const ok = await openDialog({ title: p.id ? `Edit ${p.name}` : 'New product', wide: true, body: productForm(p), actions: [{ label: 'Cancel', value: null }, { label: 'Save to draft', submit: true, kind: 'primary' }],
    onSubmit: (fd) => { P.saveProduct(pf(), { id: p.id, kind: fd.get('pf-kind'), name: fd.get('pf-name'), summary: fd.get('pf-summary'), description: fd.get('pf-description'), status: fd.get('pf-status'), personas: fd.getAll('pf-persona'),
      metrics: readMetrics(fd, p),
      tiers: [0, 1, 2].filter((i) => fd.has(`pf-tier-name-${i}`)).map((i) => ({ id: fd.get(`pf-tier-id-${i}`) || undefined, name: String(fd.get(`pf-tier-name-${i}`)), features: String(fd.get(`pf-tier-feat-${i}`) || '').split('\n') })) }); } });
  commit(); if (ok) toast('Product saved to the draft catalog. Set a price for each enabled metric under Pricing.');
}
async function editSku(s, isNew) {
  const d = pf().catalog.draft;
  const ok = await openDialog({ title: isNew ? `New ${s.type === 'bundle' ? 'bundle' : 'individual'} SKU` : `Edit ${s.id}`, wide: true, body: skuForm(d, s, isNew), actions: [{ label: 'Cancel', value: null }, { label: 'Save to draft', submit: true, kind: 'primary' }],
    // Individual SKU: show only the metric checkboxes of the chosen product.
    onMount: (dlg) => { if (s.type === 'bundle') return; const sync = () => { const pid = dlg.querySelector('[data-sku-product]:checked')?.value;
      dlg.querySelectorAll('[data-sku-metrics] [data-for]').forEach((el) => { el.style.display = el.dataset.for === pid ? '' : 'none'; }); const none = dlg.querySelector('[data-none]'); if (none) none.hidden = !!pid; };
      dlg.addEventListener('change', (e) => { if (e.target.matches('[data-sku-product]')) sync(); }); sync(); },
    onSubmit: (fd) => {
      const fixed = s.type === 'bundle' && fd.get('sf-qtype') === 'fixed_package';
      const min = toQty(fd.get('sf-min')), max = toQty(fd.get('sf-max'));
      if (!min || !max || max < min) throw new Error('Quantity limits must be whole numbers, with maximum at least the minimum.');
      const discountBps = s.type === 'bundle' && !fixed ? toBps(fd.get('sf-discount')) : 0;
      if (discountBps == null || discountBps > 6000) throw new Error('Bundle discount must be a percentage from 0 to 60.');
      const pack = fixed ? toMinor(fd.get('sf-pack')) : undefined;
      if (fixed && !pack) throw new Error('Enter a pack price, e.g. 420.00.');
      const components = fd.getAll('sf-inc').map((pid) => { const c = { productId: pid, tierId: fd.get(`sf-tier-${pid}`) }; if (fixed) { c.fixedSeats = toQty(fd.get(`sf-fixed-${pid}`)); if (!c.fixedSeats) throw new Error(`${product(d, pid).name}: fixed seats per pack must be a whole number above 0.`); } return c; });
      if (s.type === 'standalone' && components.length !== 1) throw new Error('An individual SKU contains exactly one product.');
      if (s.type === 'bundle' && components.length < 2) throw new Error('A bundle needs at least two modules.');
      let metrics, def;
      if (s.type === 'bundle') {
        metrics = fd.getAll('sf-m');
        if (!metrics.length) throw new Error('Choose at least one way to license the bundle.');
        if (fixed && metrics.includes('bundle_seat')) throw new Error('A fixed pack cannot also offer shared bundle seats.');
      } else {
        const pid = components[0]?.productId;
        metrics = fd.getAll(`sf-m-${pid}`);
        if (!metrics.length) throw new Error('Offer at least one licence metric enabled on the product.');
      }
      def = String(fd.get('sf-default'));
      if (!metrics.includes(def)) def = metrics[0];
      const charge = s.type === 'bundle' ? 'recurring' : String(fd.get('sf-charge'));
      const next = { id: String(fd.get('sf-id')), type: s.type, name: String(fd.get('sf-name')).trim(), description: String(fd.get('sf-description')).trim(), status: fd.get('sf-status'), audience: fd.getAll('sf-audience'), components,
        licenseMetrics: metrics, defaultMetric: def, chargeType: charge, quantityRule: { type: fixed ? 'fixed_package' : 'per_module', min, max }, discountBps };
      if (metrics.includes('bundle_seat')) {
        const price = toMinor(fd.get('sf-bsp')), bmin = toQty(fd.get('sf-bsmin')), bmax = toQty(fd.get('sf-bsmax'));
        if (!price) throw new Error('Enter a price per bundle seat, e.g. 46.00.');
        if (!bmin || !bmax || bmax < bmin) throw new Error('Bundle seat limits must be whole numbers, maximum at least the minimum.');
        next.bundleSeatPriceMinor = price; next.bundleSeatRule = { min: bmin, max: bmax };
      }
      if (!next.name) throw new Error('SKU name is required.');
      if (fixed) next.packagePriceMinor = pack;
      P.saveSku(pf(), next, isNew ? null : s.id);
    } });
  commit(); if (ok) toast('SKU saved to the draft. Publish to make it live.');
}
const app = mount({ page: 'veridex-admin', persona: 'tenant', view, handlers: {
  role: (el) => { pf().role = el.value; commit(); },
  'product-new': () => editProduct({ personas: ['tenant', 'carrier'], status: 'active', kind: 'module', metrics: [{ key: 'per_seat', enabled: true }], tiers: [{ name: 'Standard', features: [] }] }),
  'product-edit': (el) => editProduct(product(pf().catalog.draft, el.dataset.id)),
  'sku-new': (el) => editSku({ id: '', type: el.dataset.arg, name: '', description: '', status: 'published', audience: ['tenant'], components: [], licenseMetrics: ['per_seat'], defaultMetric: 'per_seat', chargeType: 'recurring', quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps: el.dataset.arg === 'bundle' ? 1000 : 0, bundleSeatRule: { min: 2, max: 5000 } }, true),
  'sku-edit': (el) => editSku(pf().catalog.draft.skus.find((s) => s.id === el.dataset.id), false),
  'sku-status': async (el) => {
    if (el.dataset.arg === 'retired' && !(await confirmDialog({ title: `Retire ${el.dataset.id}?`, body: html`<p>After the next publish it disappears from the shops. Customers who already bought it keep their capacity and prices.</p>`, confirmLabel: 'Retire in draft' }))) return;
    P.setSkuStatus(pf(), el.dataset.id, el.dataset.arg); commit();
  },
  price: (el) => { const m = toMinor(el.value); if (!m) { toast('Enter a price above 0 with up to two decimals, e.g. 42.00.', 'error'); app.refresh(); return; } P.setPrice(pf(), el.dataset.id, m); commit(); },
  'flag-setting': (el) => { P.setFlag(pf(), el.id, el.checked); commit(); },
  setting: (el) => { const b = toBps(el.value); if (b == null) { toast('Enter a percentage such as 10 or 8.25.', 'error'); app.refresh(); return; } P.setSetting(pf(), el.id, b); commit(); },
  discard: async () => { if (await confirmDialog({ title: 'Discard all draft changes?', body: html`<p>The draft returns to the live catalog.</p>`, confirmLabel: 'Discard' })) { P.discardDraft(pf()); commit(); } },
  publish: async () => {
    const changes = P.draftChanges(pf()), eff = document.getElementById('eff').value;
    const effectiveAt = eff ? new Date(eff + 'T00:00:00').toISOString() : null;
    const ok = await openDialog({ title: effectiveAt ? 'Schedule this catalog?' : 'Publish this catalog now?', body: html`${alert('warning', 'This is a consequential commercial change.', html`<p class="small">${effectiveAt ? `Buyers see it from ${eff}.` : 'Buyers see it immediately.'} Existing orders and subscriptions are not changed.</p>`)}<ul>${changes.map((c) => html`<li>${c}</li>`)}</ul>
        <label class="check"><input type="checkbox" name="ack"><span>I have reviewed these ${changes.length} change(s) and their effect on new purchases.</span></label>`,
      actions: [{ label: 'Cancel', value: null }, { label: effectiveAt ? 'Schedule' : 'Publish', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { if (fd.get('ack') !== 'on') throw new Error('Tick the review confirmation to continue.'); P.publish(pf(), { effectiveAt }); } });
    commit(); if (ok) toast(effectiveAt ? 'Catalog scheduled.' : `Catalog v${pf().catalog.version} is live in both shops.`);
  },
  'sched-now': () => { P.promoteScheduled(pf(), undefined, true); commit(); toast('Scheduled catalog is now live.'); },
  'sched-cancel': () => { P.cancelScheduled(pf()); commit(); },
  'qp-persona': (el) => { local.qp.persona = el.value; app.refresh(); },
  'qp-demand': (el) => { local.qp.demand[el.dataset.id] = toQty(el.value) || 0; app.refresh(); },
} });
window.addEventListener('hashchange', () => { app.refresh(); window.scrollTo(0, 0); });
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
