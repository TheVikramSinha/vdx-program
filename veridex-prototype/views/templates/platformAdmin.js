// VeriDex Admin (platform-side) views: catalog, SKUs, pricing, publishing, quote preview, customers, orders, audit.
import { html } from './html.js';
import { icon, badge, alert, field, date, dateTime, money } from './components.js';
import { product, tier, unitPrice, isFixed, componentLabel, priceKey } from '../../models/catalog.js';
import { fromMinor, bpsLabel } from '../../models/money.js';
import { PLATFORM_ROLES } from '../../models/platform.js';

export const TABS = [['overview', 'Overview', 'box'], ['products', 'Products & tiers', 'box'], ['skus', 'SKUs & bundles', 'box'], ['pricing', 'Pricing', 'shield'], ['publish', 'Review & publish', 'arrow'], ['quote', 'Quote preview', 'info'], ['customers', 'Customers', 'user'], ['orders', 'Orders & billing', 'clock'], ['audit', 'Roles & audit', 'lock']];
const STATUS = { active: 'success', draft: 'outline', retired: 'neutral', published: 'success' };
const sb = (s) => badge(s[0].toUpperCase() + s.slice(1), STATUS[s] || 'neutral', s === 'retired' ? 'pause' : s === 'draft' ? 'clock' : 'check');
const ro = (vm) => (vm.canEdit ? '' : html`disabled`);

function overview(vm) {
  const { platform, changes, issues } = vm, c = platform.catalog;
  return html`<div class="stack"><div class="grid g4"><div class="card tight stat"><b>v${c.version}</b><span>Live catalog version</span></div><div class="card tight stat"><b>${c.published.skus.filter((s) => s.status === 'published').length}</b><span>Published SKUs</span></div>
    <div class="card tight stat"><b>${changes.length}</b><span>Unpublished draft changes</span></div><div class="card tight stat"><b>${platform.orders.length}</b><span>Orders</span></div></div>
    ${changes.length ? alert('warning', 'The draft differs from the live catalog.', html`<p class="small">${changes.length} change(s), ${issues.filter((i) => i.level === 'error').length} validation error(s). <a href="#publish">Review and publish</a></p>`) : alert('success', 'Draft and live catalog match.')}
    ${c.scheduled ? alert('info', `A catalog version is scheduled for ${date(c.scheduled.effectiveAt)}.`, html`<p class="small"><a href="#publish">Manage schedule</a></p>`) : ''}
    <section class="card"><h2>From product to tenant: how the pieces connect</h2><ol><li><b>Products &amp; tiers</b> — what a module is and who may buy it.</li><li><b>Pricing</b> — a per-seat monthly price for every product tier, plus cadence and tax-estimate settings.</li><li><b>SKUs &amp; bundles</b> — what is sold: one module, or a bundle with per-module seat counts or fixed packs.</li>
      <li><b>Review &amp; publish</b> — validate, preview the difference, publish a new immutable version (now or scheduled).</li><li><b>Storefront</b> — tenant and carrier shops read only the live version.</li><li><b>Order</b> — stores its own copy of SKU, quantities and prices.</li><li><b>Tenant Admin</b> — sees per-module capacity from its orders; never the catalog.</li></ol></section></div>`;
}
function products(vm) {
  const d = vm.platform.catalog.draft;
  return html`<div class="stack"><div class="row between"><p class="muted" style="margin:0">Draft catalog. Changes go live only when published.</p><button class="btn btn-primary" data-action="product-new" ${ro(vm)}>New product</button></div>
    <div class="table-wrap"><table><thead><tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Eligible personas</th><th scope="col">Tiers and price / seat / month</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${d.products.map((p) => html`<tr><th scope="row">${p.name}<br><span class="small muted">${p.summary}</span><br><span class="mono muted">${p.id}</span></th><td>${sb(p.status)}</td><td>${p.personas.join(', ') || '—'}</td>
        <td>${p.tiers.map((t) => html`<div>${t.name}: ${unitPrice(d, p.id, t.id) ? money(unitPrice(d, p.id, t.id)) : badge('No price', 'danger', 'stop')}</div>`)}</td>
        <td class="actions"><button class="btn btn-ghost btn-sm" data-action="product-edit" data-id="${p.id}" ${ro(vm)}>Edit<span class="sr-only"> ${p.name}</span></button></td></tr>`)}</tbody></table></div></div>`;
}
function skus(vm) {
  const d = vm.platform.catalog.draft;
  const row = (s) => html`<tr><th scope="row">${s.name}<br><span class="mono muted">${s.id}</span></th><td>${sb(s.status)}</td><td>${s.audience.join(', ')}</td>
    <td>${s.components.map((c) => html`<div>${componentLabel(d, c)}${c.fixedSeats ? ` × ${c.fixedSeats}` : ''}</div>`)}</td>
    <td class="small">${isFixed(s) ? html`Fixed pack · ${money(s.packagePriceMinor || 0)} / pack<br>${s.quantityRule.min}–${s.quantityRule.max} packs` : html`Seats per module · ${s.quantityRule.min}–${s.quantityRule.max}${s.type === 'bundle' ? html`<br>${bpsLabel(s.discountBps)} off each module` : ''}`}</td>
    <td class="actions"><button class="btn btn-ghost btn-sm" data-action="sku-edit" data-id="${s.id}" ${ro(vm)}>Edit</button> ${s.status === 'published' ? html`<button class="btn-link" data-action="sku-status" data-id="${s.id}" data-arg="retired" ${ro(vm)}>Retire</button>` : html`<button class="btn-link" data-action="sku-status" data-id="${s.id}" data-arg="published" ${ro(vm)}>Mark for publish</button>`}</td></tr>`;
  const table = (title, list) => html`<div class="table-wrap"><table><caption>${title}</caption><thead><tr><th scope="col">SKU</th><th scope="col">Status</th><th scope="col">Audience</th><th scope="col">Includes</th><th scope="col">Quantity and price rule</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${list.map(row)}</tbody></table></div>`;
  return html`<div class="stack"><div class="row between"><p class="muted" style="margin:0">A SKU is what a customer buys. SKU ids are stable and appear on orders, receipts and subscriptions.</p>
    <div class="row"><button class="btn btn-secondary" data-action="sku-new" data-arg="standalone" ${ro(vm)}>New individual SKU</button><button class="btn btn-primary" data-action="sku-new" data-arg="bundle" ${ro(vm)}>New bundle SKU</button></div></div>
    ${table('Bundles', d.skus.filter((s) => s.type === 'bundle'))}${table('Individual modules', d.skus.filter((s) => s.type === 'standalone'))}
    ${alert('info', 'Overlap and compatibility rules (demo policy)', html`<ul class="small"><li>Same module, same tier from two SKUs in one order: capacities add; each line is charged once.</li><li>Same module at two tiers: blocked until the buyer removes one.</li><li>Fixed packs are not customizable; buyers add individual SKUs for extra seats.</li><li>Bundle discounts do not stack with each other; the annual prepay discount applies after them.</li></ul>`)}</div>`;
}
function pricing(vm) {
  const d = vm.platform.catalog.draft, live = vm.platform.catalog.published;
  return html`<div class="stack"><div class="table-wrap"><table><caption>Price book (draft) · USD · per seat per month</caption><thead><tr><th scope="col">Product</th><th scope="col">Tier</th><th scope="col" class="num">Live price</th><th scope="col">Draft price</th></tr></thead>
    <tbody>${d.products.flatMap((p) => p.tiers.map((t) => { const k = priceKey(p.id, t.id); return html`<tr><th scope="row">${p.name}</th><td>${t.name}</td><td class="num">${live.prices[k] ? money(live.prices[k]) : '—'}</td>
      <td><label class="sr-only" for="price-${k}">${p.name} ${t.name} draft price in dollars</label><input type="text" inputmode="decimal" id="price-${k}" style="max-width:140px" value="${d.prices[k] ? fromMinor(d.prices[k]) : ''}" data-change="price" data-id="${k}" ${ro(vm)}>${d.prices[k] !== live.prices[k] ? html` ${badge('Changed', 'warning', 'warn')}` : ''}</td></tr>`; }))}</tbody></table></div>
    <section class="card"><h2>Billing settings</h2><div class="form-grid">
      ${field({ id: 'annualDiscountBps', label: 'Annual prepay discount (%)', value: d.settings.annualDiscountBps / 100, hint: 'Applied after bundle discounts to the 12-month total.', attrs: `data-change="setting" inputmode="decimal" ${vm.canEdit ? '' : 'disabled'}` })}
      ${field({ id: 'taxBps', label: 'Tax estimate rate for the demo (%)', value: d.settings.taxBps / 100, hint: 'Production would call a tax service by buyer location.', attrs: `data-change="setting" inputmode="decimal" ${vm.canEdit ? '' : 'disabled'}` })}</div>
      <p class="small muted" style="margin-top:var(--s3)">Currency: USD only in this demo. The price book is keyed per product tier so further currencies or customer-specific price books can be added as separate books.</p></section>
    ${alert('info', 'Price changes never rewrite existing orders.', html`<p class="small">Orders and subscription lines keep the SKU, quantities and unit prices from the catalog version they were bought on. New prices apply to new purchases and added seats after publishing. Renewal repricing is a business policy still to confirm.</p>`)}</div>`;
}
function publish(vm) {
  const { platform, changes, issues, canPublish } = vm, c = platform.catalog, errs = issues.filter((i) => i.level === 'error');
  return html`<div class="stack">
    <section class="card"><div class="panel-title"><h2>1 · Validate</h2>${errs.length ? badge(`${errs.length} error${errs.length > 1 ? 's' : ''}`, 'danger', 'stop') : badge('No errors', 'success', 'check')}</div>
      ${issues.length ? html`<ul>${issues.map((i) => html`<li><b>${i.level === 'error' ? 'Error' : 'Warning'}</b> · ${i.where}: ${i.msg}</li>`)}</ul>` : html`<p class="muted">The draft catalog is valid.</p>`}</section>
    <section class="card"><h2>2 · Review changes against live v${c.version}</h2>${changes.length ? html`<ul>${changes.map((x) => html`<li>${x}</li>`)}</ul>` : html`<p class="muted">No differences. Nothing to publish.</p>`}
      <div class="row"><a class="btn btn-ghost btn-sm" href="#quote">Preview a customer quote on the draft</a><button class="btn-link" data-action="discard" ${changes.length && vm.canEdit ? '' : html`disabled`}>Discard draft changes</button></div></section>
    <section class="card"><h2>3 · Publish</h2><dl class="kv"><dt>New purchases</dt><dd>Use the new version immediately (or from the scheduled date).</dd><dt>Existing subscriptions</dt><dd>Unchanged. They keep their purchased SKU, capacity and prices.</dd><dt>Retired SKUs</dt><dd>Disappear from the shops; existing customers keep what they bought.</dd><dt>Open carts</dt><dd>Re-priced on the live catalog; a buyer who was mid-checkout must review again.</dd></dl>
      <div class="row" style="align-items:flex-end;margin-top:var(--s4)"><div class="field"><label for="eff">Effective date <span class="opt">(optional — leave empty to publish now)</span></label><input type="date" id="eff" style="width:auto" ${canPublish ? '' : html`disabled`}></div>
        <button class="btn btn-primary" data-action="publish" ${canPublish && changes.length && !errs.length ? '' : html`disabled`}>Publish catalog…</button></div>
      ${!canPublish ? html`<p class="small muted" style="margin-top:var(--s2)">${icon('lock')} Your role cannot publish. A pricing approver or platform administrator must do it.</p>` : ''}
      ${c.scheduled ? alert('info', `Scheduled for ${date(c.scheduled.effectiveAt)} by ${c.scheduled.by}`, html`<ul class="small">${c.scheduled.changes.map((x) => html`<li>${x}</li>`)}</ul><div class="row"><button class="btn btn-ghost btn-sm" data-action="sched-now" ${canPublish ? '' : html`disabled`}>Go live now (demo)</button><button class="btn-link" data-action="sched-cancel" ${canPublish ? '' : html`disabled`}>Cancel schedule</button></div>`) : ''}</section>
    <div class="table-wrap"><table><caption>Version history</caption><thead><tr><th scope="col">Version</th><th scope="col">Published</th><th scope="col">By</th><th scope="col">Changes</th></tr></thead><tbody>${c.history.map((h) => html`<tr><th scope="row">v${h.version}</th><td>${dateTime(h.at)}</td><td>${h.by}</td><td class="small">${h.changes.join(' · ')}</td></tr>`)}</tbody></table></div></div>`;
}
function quotePreview(vm) {
  const d = vm.platform.catalog.draft, { qp, options } = vm;
  const prods = d.products.filter((p) => p.status === 'active');
  return html`<div class="stack"><section class="card"><h2>Preview a customer quote on the <u>draft</u> catalog</h2><p class="small muted">Enter the seats a buyer needs per module. The table shows what the storefront would offer, including seats beyond need. Default: the 10 Claims + 4 Legal worked example.</p>
    <div class="row" style="align-items:flex-end"><div class="field"><label for="qp-persona">Persona</label><select id="qp-persona" data-change="qp-persona" style="width:auto"><option value="tenant" ${qp.persona === 'tenant' ? html`selected` : ''}>Tenant</option><option value="carrier" ${qp.persona === 'carrier' ? html`selected` : ''}>Carrier</option></select></div>
      ${prods.map((p) => html`<div class="field" style="max-width:130px"><label for="qp-${p.id}">${p.name}</label><input type="number" min="0" max="500" id="qp-${p.id}" value="${qp.demand[p.id] || 0}" data-change="qp-demand" data-id="${p.id}"></div>`)}</div></section>
    ${options.length ? html`<div class="table-wrap"><table><caption>Options for this demand (monthly, using draft prices and draft SKUs marked published)</caption><thead><tr><th scope="col">Option</th><th scope="col">Buyer enters</th><th scope="col">Capacity per module</th><th scope="col">Seats beyond need</th><th scope="col" class="num">Monthly</th></tr></thead>
      <tbody>${options.map((o) => html`<tr><th scope="row">${o.name}${o.skuId ? html`<br><span class="mono muted">${o.skuId}</span>` : ''}</th><td class="small">${o.kind === 'fixed' ? `${o.packages} pack(s)` : 'A seat count per module'}</td>
        <td class="small">${o.parts.map((p) => html`<div>${p.label}: <b>${p.seats}</b>${p.unitMinor ? html` × ${money(p.unitMinor)}` : ''}</div>`)}</td><td>${o.excessSeats ? badge(`${o.excessSeats} paid, not needed`, 'warning', 'warn') : badge('None', 'success', 'check')}</td><td class="num"><b>${money(o.monthlyMinor)}</b></td></tr>`)}</tbody></table></div>` : html`<div class="empty"><h3>No option covers this demand</h3><p>Enter seats, or check that SKUs for this persona are marked published in the draft.</p></div>`}</div>`;
}
function customers(vm) {
  return html`<div class="stack">${alert('info', 'Privacy boundary', html`<p class="small">Platform staff see commercial facts: orders, SKUs and seat counts. Tenant rosters, names and emails of workspace members are not shown here.</p>`)}
    ${vm.customers.map((c) => html`<section class="card"><div class="panel-title"><h2>${c.name}</h2>${badge(c.persona === 'carrier' ? 'Carrier' : 'Tenant', 'info')}</div>
      ${!c.subs.length ? html`<p class="muted">No purchase yet.</p>` : html`<dl class="kv"><dt>Billing contact</dt><dd>${c.contact?.name || '—'} · ${c.contact?.email || '—'}</dd><dt>Onboarding</dt><dd>${c.onboarded ? 'Completed (demo)' : 'Not completed'}</dd><dt>Subscriptions</dt><dd>${c.subs.map((s) => html`<div>${s.skuName} <span class="mono muted">${s.skuId}</span> · v${s.catalogVersion} · ${s.cadence} · renews ${date(s.renewsAt)}</div>`)}</dd></dl>
      <div class="table-wrap" style="margin-top:var(--s3)"><table><thead><tr><th scope="col">Module</th><th scope="col" class="num">Purchased</th><th scope="col" class="num">Assigned</th><th scope="col" class="num">Reserved</th><th scope="col" class="num">Available</th></tr></thead><tbody>${c.cap.map((x) => html`<tr><th scope="row">${x.productName} ${x.tierName}</th><td class="num">${x.purchased}</td><td class="num">${x.assigned}</td><td class="num">${x.reserved}</td><td class="num">${x.available}</td></tr>`)}</tbody></table></div>
      <p class="small muted" style="margin:var(--s2) 0 0">${c.people} people · ${c.leads} lead/support record(s) for this persona</p>`}</section>`)}</div>`;
}
function orders(vm) {
  const p = vm.platform;
  return html`<div class="stack">${!p.orders.length ? html`<div class="empty"><h3>No orders yet</h3><p>Complete a simulated purchase in a shop.</p></div>` : html`<div class="table-wrap"><table><caption>Orders (each keeps its own price snapshot)</caption><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Lines</th><th scope="col">Catalog</th><th scope="col" class="num">Paid</th></tr></thead>
    <tbody>${p.orders.map((o) => html`<tr><th scope="row" class="mono">${o.id}<br><span class="small muted">${date(o.createdAt)}</span></th><td>${o.persona}<br><span class="small muted">${o.contact?.company || o.contact?.name || ''}</span></td>
      <td class="small">${o.lines.map((l) => html`<div><b>${l.skuId}</b> ${l.components.map((c) => `${c.seats} ${c.productName} ${c.tierName}${c.unitNetMinor != null ? ' @ ' + money(c.unitNetMinor) : ''}`).join(' + ')}</div>`)}${o.kind === 'add_seats' ? badge('Added seats', 'info') : ''}</td><td>v${o.catalogVersion}</td><td class="num">${money(o.totalDueMinor)}</td></tr>`)}</tbody></table></div>`}
    ${p.billingEvents.length ? html`<div class="table-wrap"><table><caption>Billing events (simulated payment adapter)</caption><thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Persona</th><th scope="col">Session / reference</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${p.billingEvents.map((e) => html`<tr><td class="small">${dateTime(e.at)}</td><th scope="row">${badge(e.type.replace('_', ' '), e.type === 'payment_approved' ? 'success' : e.type === 'payment_declined' ? 'danger' : 'warning', e.type === 'payment_approved' ? 'check' : 'warn')}</th><td>${e.persona}</td><td class="small mono">${e.sessionId || ''} ${e.ref || ''}<br><span style="font-family:var(--font)">${e.note || ''}</span></td><td class="num">${money(e.amountMinor)}</td></tr>`)}</tbody></table></div>` : ''}
    <p class="small"><a href="demo-leads.html">Open the lead and support inbox</a> (${p.leads.length} records)</p></div>`;
}
function auditTab(vm) {
  const p = vm.platform;
  return html`<div class="stack"><div class="table-wrap"><table><caption>Platform roles (separate from tenant roles)</caption><thead><tr><th scope="col">Role</th><th scope="col">Edit draft catalog</th><th scope="col">Publish</th><th scope="col">View customers</th><th scope="col">Manage leads</th></tr></thead>
    <tbody>${Object.entries(PLATFORM_ROLES).map(([k, r]) => html`<tr><th scope="row">${r.label}${k === p.role ? html` ${badge('You', 'info', 'user')}` : ''}</th>${['catalog.edit', 'catalog.publish', 'customers.view', 'leads.manage'].map((a) => html`<td>${r.can.includes(a) ? html`${icon('check')} Yes` : html`<span class="muted">No</span>`}</td>`)}</tr>`)}</tbody></table></div>
    <p class="small muted">Tenant workspace administrators have no platform role and cannot open this area in production. In this demo the role is switched locally; production needs server-side authorization.</p>
    ${!p.audit.length ? html`<div class="empty"><h3>No platform actions recorded yet</h3></div>` : html`<div class="table-wrap"><table><caption>Administrative history</caption><thead><tr><th scope="col">When</th><th scope="col">Role</th><th scope="col">Action</th><th scope="col">Detail</th></tr></thead><tbody>${p.audit.slice(0, 80).map((a) => html`<tr><td class="small">${dateTime(a.at)}</td><td class="small">${PLATFORM_ROLES[a.role]?.label}</td><th scope="row">${a.action}</th><td class="small">${a.detail}</td></tr>`)}</tbody></table></div>`}</div>`;
}
export function platformAdmin(vm) {
  const { platform, tab } = vm;
  return html`<div class="page-head"><div><span class="eyebrow">${icon('shield')} VeriDex Admin · platform staff</span><h1>Product and commercial administration</h1><p>Platform-side: define what VeriDex sells and at what price. Separate from any customer’s Tenant Admin.</p></div>
    <div class="field"><label for="role">Demo: act as platform role</label><select id="role" data-change="role" style="width:auto">${Object.entries(PLATFORM_ROLES).map(([k, r]) => html`<option value="${k}" ${k === platform.role ? html`selected` : ''}>${r.label}</option>`)}</select></div></div>
  ${!vm.canEdit ? alert('info', `${PLATFORM_ROLES[platform.role].label}: catalog editing is disabled for this role.`) : ''}
  <div class="admin"><nav class="side" aria-label="VeriDex Admin sections"><h4>Catalog</h4>${TABS.slice(0, 6).map(([k, l, ic]) => html`<a href="#${k}" ${tab === k ? html`aria-current="page"` : ''}>${icon(ic)} ${l}${k === 'publish' && vm.changes.length ? html` ${badge(String(vm.changes.length), 'warning')}` : ''}</a>`)}<h4>Customers</h4>${TABS.slice(6).map(([k, l, ic]) => html`<a href="#${k}" ${tab === k ? html`aria-current="page"` : ''}>${icon(ic)} ${l}</a>`)}<a href="demo-leads.html">${icon('mail')} Lead inbox</a></nav>
    <div>${{ overview, products, skus, pricing, publish, quote: quotePreview, customers, orders, audit: auditTab }[tab](vm)}</div></div>`;
}

/* ----- dialog bodies ----- */
export function productForm(p) {
  const tiers = [...(p.tiers || []), {}, {}].slice(0, Math.max(2, (p.tiers || []).length + 1)).slice(0, 3);
  return html`<div class="form-grid">${field({ id: 'pf-name', label: 'Product name', value: p.name })}${field({ id: 'pf-status', label: 'Status', value: p.status || 'active', options: [['active', 'Active — can be sold'], ['draft', 'Draft — not sellable'], ['retired', 'Retired']] })}
    <div class="full">${field({ id: 'pf-summary', label: 'Short summary', value: p.summary, attrs: 'maxlength="80"' })}</div><div class="full">${field({ id: 'pf-description', label: 'Description', type: 'textarea', value: p.description, optional: true })}</div></div>
    <fieldset><legend>Eligible customer personas</legend><div class="row">${['tenant', 'carrier'].map((x) => html`<label class="check"><input type="checkbox" name="pf-persona" value="${x}" ${(p.personas || ['tenant', 'carrier']).includes(x) ? html`checked` : ''}><span>${x[0].toUpperCase() + x.slice(1)}</span></label>`)}</div></fieldset>
    <fieldset><legend>Tiers (leave a name empty to omit)</legend><div class="stack-sm">${tiers.map((t, i) => html`<div class="form-grid card tight flat"><input type="hidden" name="pf-tier-id-${i}" value="${t.id || ''}">${field({ id: `pf-tier-name-${i}`, label: `Tier ${i + 1} name`, value: t.name })}${field({ id: `pf-tier-feat-${i}`, label: 'Features, one per line', type: 'textarea', value: (t.features || []).join('\n') })}</div>`)}</div></fieldset>
    <p class="small muted">After saving, set a price for each tier under Pricing, then create SKUs.</p>`;
}
export function skuForm(cat, s, isNew) {
  const fixed = isFixed(s);
  return html`<div class="form-grid">${field({ id: 'sf-id', label: 'SKU id', value: s.id, hint: isNew ? 'Stable id, e.g. VDX-BND-NEW. Cannot be changed later.' : 'Stable: cannot be changed.', attrs: isNew ? 'autocapitalize="characters" spellcheck="false"' : 'readonly' })}${field({ id: 'sf-name', label: 'Name', value: s.name })}
    <div class="full">${field({ id: 'sf-description', label: 'Description shown to buyers', type: 'textarea', value: s.description })}</div>
    ${field({ id: 'sf-status', label: 'Status', value: s.status, options: [['draft', 'Draft'], ['published', 'Published (goes live on next publish)'], ['retired', 'Retired']] })}
    <fieldset><legend>Audience</legend><div class="row">${['tenant', 'carrier'].map((x) => html`<label class="check"><input type="checkbox" name="sf-audience" value="${x}" ${s.audience.includes(x) ? html`checked` : ''}><span>${x[0].toUpperCase() + x.slice(1)}</span></label>`)}</div></fieldset></div>
    <fieldset><legend>${s.type === 'bundle' ? 'Included modules (two or more)' : 'Module (exactly one)'}</legend><div class="stack-sm">${cat.products.filter((p) => p.status !== 'retired').map((p) => { const c = s.components.find((x) => x.productId === p.id);
      return html`<div class="row choice" style="cursor:default"><label class="check grow" style="padding:0"><input type="checkbox" name="sf-inc" value="${p.id}" ${c ? html`checked` : ''}><span><b>${p.name}</b> <span class="small muted">${p.status}</span></span></label>
        <select name="sf-tier-${p.id}" aria-label="${p.name} tier" style="width:auto">${p.tiers.map((t) => html`<option value="${t.id}" ${c?.tierId === t.id ? html`selected` : ''}>${t.name} · ${unitPrice(cat, p.id, t.id) ? money(unitPrice(cat, p.id, t.id)) : 'no price'}</option>`)}</select>
        ${s.type === 'bundle' ? html`<label class="small">Fixed seats / pack <input type="number" min="1" max="500" name="sf-fixed-${p.id}" value="${c?.fixedSeats || 5}" style="width:80px;min-height:34px;padding:2px 6px"></label>` : ''}</div>`; })}</div></fieldset>
    ${s.type === 'bundle' ? html`<fieldset><legend>Quantity model</legend><div class="grid g2"><label class="choice"><input type="radio" name="sf-qtype" value="per_module" ${fixed ? '' : html`checked`}><span><b>Seats per module</b> (recommended)<br><span class="small muted">Buyer enters a seat count for each module. Discount % applies to each module’s unit price.</span></span></label>
      <label class="choice"><input type="radio" name="sf-qtype" value="fixed_package" ${fixed ? html`checked` : ''}><span><b>Fixed pack</b><br><span class="small muted">Set seats per pack at one pack price. Shops disclose seats beyond need.</span></span></label></div></fieldset>
      <div class="form-grid">${field({ id: 'sf-discount', label: 'Bundle discount (%) — seats-per-module only', value: (s.discountBps || 0) / 100, attrs: 'inputmode="decimal"' })}${field({ id: 'sf-pack', label: 'Pack price / month ($) — fixed pack only', value: s.packagePriceMinor ? fromMinor(s.packagePriceMinor) : '', attrs: 'inputmode="decimal"' })}</div>` : ''}
    <div class="form-grid">${field({ id: 'sf-min', label: fixed ? 'Minimum packs' : 'Minimum seats per module', type: 'number', value: s.quantityRule.min, attrs: 'min="1"' })}${field({ id: 'sf-max', label: fixed ? 'Maximum packs' : 'Maximum seats per module', type: 'number', value: s.quantityRule.max, attrs: 'min="1"' })}</div>`;
}
