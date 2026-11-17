// Storefront views (tenant and carrier): shop, review, checkout, confirmation.
import { html } from './html.js';
import { icon, money, badge, alert, field, errorSummary, checklistBox, date } from './components.js';
import { product, tier, unitPrice, isFixed, offersFor } from '../../models/catalog.js';
import { lessBps, bpsLabel } from '../../models/money.js';
import { CADENCES } from '../../models/pricing.js';
import { METHODS } from '../../services/paymentMock.js';

const qtyInput = (id, value, { min = 1, max = 500, label, action = 'qty', sku, pid = '' }) => html`<div class="qty" role="group" aria-label="${label}">
  <button type="button" data-action="step" data-id="${id}" data-arg="-1" aria-label="Decrease ${label}">−</button>
  <input type="number" inputmode="numeric" id="${id}" min="${min}" max="${max}" step="1" value="${value}" data-change="${action}" data-sku="${sku}" data-pid="${pid}" aria-label="${label}">
  <button type="button" data-action="step" data-id="${id}" data-arg="1" aria-label="Increase ${label}">+</button></div>`;

function moduleCard(vm, p) {
  const { cat, ui, inCart } = vm;
  const skus = offersFor(cat, vm.persona.id, 'standalone').filter((s) => s.components[0].productId === p.id);
  if (!skus.length) return '';
  const tierId = skus.some((s) => s.components[0].tierId === ui.tier[p.id]) ? ui.tier[p.id] : skus[0].components[0].tierId;
  const s = skus.find((x) => x.components[0].tierId === tierId);
  const seats = ui.qty[s.id]?.[p.id] ?? inCart[s.id]?.seats?.[p.id] ?? 1;
  const unit = unitPrice(cat, p.id, tierId);
  const t = tier(cat, p.id, tierId);
  const added = inCart[s.id];
  return html`<article class="card offer ${added ? 'selected' : ''}" aria-labelledby="h-${p.id}">
    <header><div><h3 id="h-${p.id}">${p.name}</h3><p class="muted small" style="margin:0">${p.summary}</p></div>${added ? badge('In order', 'success', 'check') : ''}</header>
    <fieldset><legend class="sr-only">${p.name} tier</legend><div class="segmented">${skus.map((x) => { const tt = tier(cat, p.id, x.components[0].tierId); return html`<label><input type="radio" name="tier-${p.id}" value="${tt.id}" data-change="tier" data-pid="${p.id}" ${tt.id === tierId ? html`checked` : ''}>${tt.name}</label>`; })}</div></fieldset>
    <div class="price"><b>${money(unit)}</b> <span class="muted small">per seat / month · illustrative</span></div>
    <ul class="feat">${t.features.map((f) => html`<li>${f}</li>`)}</ul>
    <div class="row between"><div class="field"><span class="small" style="font-weight:600" id="l-${s.id}">${p.name} seats</span>${qtyInput(`q-${s.id}-${p.id}`, seats, { label: `${p.name} seats`, sku: s.id, pid: p.id })}</div>
      <div class="num"><span class="muted small">Monthly</span><br><b>${Number.isInteger(seats) ? money(unit * seats) : '—'}</b></div></div>
    <div class="row between"><span class="mono muted">${s.id}</span><button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${s.id}">${added ? 'Update order' : 'Add to order'}</button></div>
  </article>`;
}

function bundleCard(vm, s) {
  const { cat, ui, inCart } = vm;
  const fixed = isFixed(s), added = inCart[s.id];
  let list = 0, net = 0, valid = true;
  const packages = ui.qty[s.id]?.packages ?? added?.packages ?? 1;
  const rows = s.components.map((c) => {
    const p = product(cat, c.productId), t = tier(cat, c.productId, c.tierId), unit = unitPrice(cat, c.productId, c.tierId);
    const seats = fixed ? c.fixedSeats * (Number.isInteger(packages) ? packages : 0) : (ui.qty[s.id]?.[c.productId] ?? added?.seats?.[c.productId] ?? s.quantityRule.min);
    if (!Number.isInteger(seats) || seats < 1) valid = false;
    const unitNet = lessBps(unit, s.discountBps || 0);
    list += unit * (seats || 0); net += unitNet * (seats || 0);
    return html`<div class="seat-row"><div><b>${p.name}</b> <span class="muted small">${t.name}</span><br><span class="small muted">${fixed ? html`${c.fixedSeats} seats per pack · list ${money(unit)}/seat` : html`<s>${money(unit)}</s> ${money(unitNet)} per seat / month`}</span></div>
      ${fixed ? html`<span class="num"><b>${seats}</b> seats</span>` : qtyInput(`q-${s.id}-${c.productId}`, seats, { label: `${p.name} seats in ${s.name}`, sku: s.id, pid: c.productId, min: s.quantityRule.min, max: s.quantityRule.max })}
      <span class="num">${fixed ? '' : Number.isInteger(seats) ? money(unitNet * seats) : '—'}</span></div>`;
  });
  if (fixed) net = s.packagePriceMinor * (Number.isInteger(packages) ? packages : 0);
  return html`<article class="card offer ${added ? 'selected' : ''}" aria-labelledby="h-${s.id}">
    <header><div><h3 id="h-${s.id}">${s.name}</h3><p class="muted small" style="margin:0">${s.description}</p></div>
      <div class="stack-sm" style="justify-items:end">${added ? badge('In order', 'success', 'check') : ''}${fixed ? badge('Fixed pack', 'info', 'box') : badge(`${bpsLabel(s.discountBps)} off each module`, 'success')}</div></header>
    <p class="small" style="margin:0"><b>${fixed ? 'Each pack includes set seats per module.' : 'You choose a separate seat count for each module.'}</b> Every module keeps its own limit; seats are never shared.</p>
    <div class="seat-rows">${rows}</div>
    ${fixed ? html`<div class="row between"><div class="field"><span class="small" style="font-weight:600">Packs</span>${qtyInput(`q-${s.id}-packages`, packages, { label: `${s.name} packs`, sku: s.id, pid: 'packages', min: s.quantityRule.min, max: s.quantityRule.max })}</div>
      <span class="small muted">${money(s.packagePriceMinor)} per pack / month</span></div>
      ${alert('info', 'Fixed packs cannot be customized.', html`<p class="small">If you need different numbers per module, the seats you do not need are still paid. Use “Seats needed” above to compare, or pick a configurable bundle or individual modules.</p>`)}` : ''}
    <div class="row between"><div><span class="muted small">Bundle price / month</span><br><b style="font-size:1.3rem">${valid ? money(net) : '—'}</b>
      ${valid && list > net ? html` <span class="small muted">vs ${money(list)} for the same seats bought individually · save ${money(list - net)}</span>` : ''}</div>
      <button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${s.id}">${added ? 'Update order' : 'Add bundle to order'}</button></div>
    <span class="mono muted">${s.id} · illustrative composition and price</span>
  </article>`;
}

function demandTool(vm) {
  const { cat, ui, options } = vm;
  const prods = cat.products.filter((p) => p.status === 'active' && p.personas.includes(vm.persona.id));
  return html`<section class="card" aria-labelledby="need-h">
    <div class="panel-title"><h3 id="need-h">Seats needed per module</h3><button class="btn-link" data-action="example">Try the 10 Claims + 4 Legal example</button></div>
    <p class="small muted">Counts only. We ask who these people are after purchase. Leave a module at 0 if you do not need it.</p>
    <div class="grid g4">${prods.map((p) => html`<div class="field"><label for="need-${p.id}">${p.name}</label><input type="number" inputmode="numeric" min="0" max="500" step="1" id="need-${p.id}" value="${ui.demand[p.id] ?? 0}" data-change="demand" data-pid="${p.id}"></div>`)}</div>
    ${options.length ? html`<div class="table-wrap" style="margin-top:var(--s4)"><table><caption>Ways to cover this need (monthly, before cadence discount and tax)</caption>
      <thead><tr><th scope="col">Option and what you enter</th><th scope="col">Capacity you receive</th><th scope="col">Seats beyond need</th><th scope="col" class="num">Monthly</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
      <tbody>${options.map((o, i) => html`<tr><th scope="row">${o.name}${i === vm.cheapest ? html`<br>${badge('Lowest cost', 'success', 'check')}` : ''}<br><span class="small muted" style="font-weight:400">${o.kind === 'fixed' ? html`You enter: ${o.packages} pack${o.packages > 1 ? 's' : ''}` : 'You enter: seats per module'}</span></th>
        <td class="small">${o.parts.map((p) => html`<div>${p.label}: <b>${p.seats}</b></div>`)}</td>
        <td class="small">${o.excessSeats ? html`${badge(`${o.excessSeats} paid, not needed`, 'warning', 'warn')}<div class="muted">${o.parts.filter((p) => p.excess).map((p) => `${p.label.split(' ')[0]} +${p.excess}`).join(', ')}</div>` : badge('None', 'success', 'check')}</td>
        <td class="num"><b>${money(o.monthlyMinor)}</b></td>
        <td class="actions"><button class="btn btn-secondary btn-sm" data-action="use-option" data-id="${i}">Use this</button></td></tr>`)}</tbody></table></div>` : html`<p class="small muted" style="margin:var(--s3) 0 0">Enter at least one seat to compare individual modules against bundles.</p>`}
  </section>`;
}

export function summary(vm) {
  const { q, cat } = vm;
  return html`<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">Your order</h2>
    ${!q.lines.length ? html`<p class="muted">Nothing added yet. Choose individual modules or a bundle.</p>` : html`
    ${q.lines.map((l) => html`<div class="cart-line"><div class="row between"><b>${l.skuName}</b><span class="num">${money(l.monthlyNetMinor)}<span class="muted small">/mo</span></span></div>
      <span class="small muted">${l.packages ? `${l.packages} pack${l.packages > 1 ? 's' : ''} → ` : ''}${l.components.map((c) => `${c.seats} ${c.productName} ${c.tierName}`).join(' + ')}</span>
      <div class="row between"><span class="mono muted">${l.skuId}</span><button class="btn-link" data-action="remove" data-id="${l.skuId}">Remove<span class="sr-only"> ${l.skuName}</span></button></div></div>`)}
    ${conflictAlerts(vm)}
    <h3 style="margin-top:var(--s4)">Capacity you will receive</h3>
    <ul class="small" style="list-style:none;padding:0">${q.capacity.map((c) => html`<li class="sum-line"><span>${c.productName} <span class="muted">${Object.values(c.tiers).join(' / ')}</span></span><b>${c.seats} seats</b></li>`)}</ul>
    <fieldset style="margin:var(--s3) 0"><legend>Billing</legend><div class="segmented">${Object.entries(CADENCES).map(([k, c]) => html`<label><input type="radio" name="cadence" value="${k}" data-change="cadence" ${q.cadence === k ? html`checked` : ''}>${c.label}${k === 'annual' ? html` <span class="small">−${bpsLabel(cat.settings.annualDiscountBps)}</span>` : ''}</label>`)}</div></fieldset>
    ${totals(q)}
    <a class="btn btn-primary btn-block" href="#review" style="margin-top:var(--s3)" ${q.purchasable ? '' : html`aria-disabled="true" data-action="noop"`}>Review order ${icon('arrow')}</a>`}
    <p class="small muted" style="margin:var(--s3) 0 0">${icon('lock')} No names, emails or workspace details are needed to buy.</p></section>`;
}
export function conflictAlerts(vm) {
  const { q, existing } = vm;
  return html`${q.errors.map((e) => alert('danger', e))}
    ${q.conflicts.map((c) => alert('danger', `${c.productName} is in your order at two tiers`, html`<p class="small">${c.sources.map((s) => `${s.skuName} (${s.tierName})`).join(' and ')}. One module runs at one tier. Remove one of them to continue.</p><div class="row">${c.sources.map((s) => html`<button class="btn btn-ghost btn-sm" data-action="remove" data-id="${s.skuId}">Remove ${s.skuName}</button>`)}</div>`))}
    ${q.overlaps.map((c) => alert('info', `${c.productName}: capacity adds up`, html`<p class="small">${c.sources.map((s) => `${s.seats} from ${s.skuName}`).join(' + ')} = <b>${c.seats} ${c.productName} seats</b>. Each line is charged once.</p>`))}
    ${existing.map((m) => alert('danger', m))}`;
}
export function totals(q) {
  return html`<div>
    ${q.bundleSavingMinor ? html`<div class="sum-line small"><span>Individual list price / month</span><span class="num"><s>${money(q.monthlyListMinor)}</s></span></div><div class="sum-line small"><span>Bundle saving / month</span><span class="num">−${money(q.bundleSavingMinor)}</span></div>` : ''}
    <div class="sum-line"><span>Monthly price</span><span class="num">${money(q.monthlyNetMinor)}</span></div>
    ${q.cadence === 'annual' ? html`<div class="sum-line small"><span>12 months</span><span class="num">${money(q.periodGrossMinor)}</span></div><div class="sum-line small"><span>Annual prepay discount (${bpsLabel(q.annualDiscountBps)})</span><span class="num">−${money(q.cadenceDiscountMinor)}</span></div>
      <div class="sum-line small muted"><span>Monthly equivalent</span><span class="num">${money(q.monthlyEquivalentMinor)}</span></div>` : ''}
    <div class="sum-line small"><span>Estimated tax (${bpsLabel(q.taxBps)}, demo rate)</span><span class="num">${money(q.taxMinor)}</span></div>
    <div class="sum-line total"><span>Due today</span><span class="num">${money(q.totalDueMinor)}</span></div>
    <p class="small muted" style="margin:4px 0 0">${q.cadence === 'annual' ? 'Charged once for 12 months, then renews yearly.' : 'Charged today, then renews each month.'} USD. Illustrative prices.</p></div>`;
}

export function shop(vm) {
  const { persona, cat, ui } = vm;
  const tab = ui.tab;
  const prods = cat.products.filter((p) => p.status === 'active' && p.personas.includes(persona.id));
  const bundles = offersFor(cat, persona.id, 'bundle').sort((a, b) => (b.id === persona.featured) - (a.id === persona.featured));
  const T = [['modules', 'Individual modules', 'Buy one module at a time, per seat.'], ['bundles', 'Product bundles', 'One SKU, several modules, lower price.'], ['guidance', 'Expert guidance', 'Not sure? Get help choosing.']];
  return html`
  <section class="hero"><div><span class="eyebrow">${persona.label}</span><h1>${persona.hero.title}</h1><p class="lead">${persona.hero.lead}</p>
    <div class="row"><a class="btn btn-secondary" href="assistance.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Get expert guidance</a>${vm.hasSubscription ? html`<a class="btn btn-ghost" href="tenant-admin.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Manage your subscription</a>` : ''}</div></div>
    <ul>${persona.proof.map((x) => html`<li>${icon('check')} ${x}</li>`)}</ul></section>
  ${vm.hasSubscription ? alert('info', 'This demo workspace already has a subscription.', html`<p class="small">A new order adds capacity to modules at the same tier. To add seats to one module, Tenant Admin → Billing is quicker.</p>`) : ''}
  <div class="offer-tabs" role="tablist" aria-label="How would you like to buy?">${T.map(([k, a, b]) => html`<button role="tab" id="tab-${k}" aria-selected="${String(tab === k)}" aria-controls="offers" data-action="tab" data-id="${k}"><b>${a}</b><span>${b}</span></button>`)}</div>
  <div class="with-aside"><div class="stack" id="offers" role="tabpanel" aria-labelledby="tab-${tab}">
    ${tab === 'modules' ? html`<div class="grid g2">${prods.map((p) => moduleCard(vm, p))}</div>
      <details class="card tight"><summary><b>Compare tiers</b></summary><div class="table-wrap" style="margin-top:var(--s3)"><table><thead><tr><th scope="col">Module</th><th scope="col">Tier</th><th scope="col">Includes</th><th scope="col" class="num">Per seat / month</th></tr></thead>
        <tbody>${prods.flatMap((p) => p.tiers.map((t) => html`<tr><th scope="row">${p.name}</th><td>${t.name}</td><td class="small">${t.features.join(' · ')}</td><td class="num">${unitPrice(cat, p.id, t.id) ? money(unitPrice(cat, p.id, t.id)) : '—'}</td></tr>`))}</tbody></table></div></details>` : ''}
    ${tab === 'bundles' ? html`${demandTool(vm)}${bundles.length ? bundles.map((s) => bundleCard(vm, s)) : html`<div class="empty"><h3>No bundles are published for this journey</h3><p>Choose individual modules, or ask for guidance.</p></div>`}` : ''}
    ${tab === 'guidance' ? html`<section class="card"><h2>Not sure what to buy?</h2><p>Tell us roughly who you are and what you want to achieve. A VeriDex specialist would follow up. Your order here is not changed.</p>
      <ul><li>No team roster or workspace name needed</li><li>“Not sure” is a valid answer everywhere</li><li>You get a downloadable brief of your request</li></ul>
      <div class="row"><a class="btn btn-primary" href="assistance.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Start guided request ${icon('arrow')}</a><button class="btn btn-ghost" data-action="open-chat">${icon('chat')} Open chat</button></div></section>` : ''}
  </div><aside>${summary(vm)}</aside></div>`;
}

export function review(vm) {
  const { q, checklist, gate, persona } = vm;
  if (!q.lines.length) return html`<div class="empty"><h3>Your order is empty</h3><p><a href="#shop">Back to the shop</a></p></div>`;
  return html`<div class="page-head"><div><span class="eyebrow">${persona.short} order</span><h1>Review your order</h1><p>Check each SKU, the seats each module receives, and what you pay today.</p></div><a class="btn btn-ghost" href="#shop">Edit order</a></div>
  <div class="with-aside"><div class="stack">
    ${conflictAlerts(vm)}
    <div class="table-wrap"><table><caption>Order lines</caption><thead><tr><th scope="col">SKU</th><th scope="col">Module and tier</th><th scope="col" class="num">Seats</th><th scope="col" class="num">List / seat</th><th scope="col" class="num">Your price / seat</th><th scope="col" class="num">Monthly</th></tr></thead>
      <tbody>${q.lines.map((l) => l.components.map((c, i) => html`<tr>${i === 0 ? html`<th scope="rowgroup" rowspan="${l.components.length}"><b>${l.skuName}</b><br><span class="mono muted">${l.skuId}</span><br>${badge(l.skuType === 'bundle' ? (l.packages ? `Fixed pack × ${l.packages}` : `Bundle · ${bpsLabel(l.discountBps)} off`) : 'Individual module', l.skuType === 'bundle' ? 'info' : 'outline')}</th>` : ''}
        <td>${c.productName} <span class="muted">${c.tierName}</span></td><td class="num">${c.seats}</td><td class="num">${money(c.unitListMinor)}</td><td class="num">${c.unitNetMinor == null ? html`<span class="small muted">pack price</span>` : money(c.unitNetMinor)}</td>
        ${i === 0 ? html`<td class="num" rowspan="${l.components.length}"><b>${money(l.monthlyNetMinor)}</b>${l.monthlySavingMinor ? html`<br><span class="small muted">saves ${money(l.monthlySavingMinor)} vs individual</span>` : ''}</td>` : ''}</tr>`))}</tbody></table></div>
    <section class="card"><h2>Capacity by module</h2><p class="small muted">Each module has its own seat limit. A person who uses two modules needs a seat in each. The workspace administrator is free and uses no seat.</p>
      <div class="grid g3">${q.capacity.map((c) => html`<div class="card tight flat stat"><b>${c.seats}</b><span>${c.productName} ${Object.values(c.tiers).join(' / ')} seats</span></div>`)}</div></section>
    <section class="card"><h2>Billing commitment</h2><dl class="kv"><dt>Cadence</dt><dd>${CADENCES[q.cadence].label}</dd><dt>First charge</dt><dd>${money(q.totalDueMinor)} today (simulated)</dd><dt>Renews</dt><dd>${date(vm.renewsAt)} for ${money(q.totalDueMinor)} unless changed · estimate</dd>
      <dt>Unused seats</dt><dd>Stay paid until you reduce purchased seats in Tenant Admin</dd><dt>Adding seats later</dt><dd>Separate purchase with an illustrative prorated price</dd></dl></section>
  </div><aside>
    <section class="card"><h2>Amount due</h2>${totals(q)}</section>
    ${checklistBox(checklist, { title: 'Before checkout' })}
    ${vm.showGateErrors && !gate.ok ? errorSummary(Object.fromEntries(gate.missing.map((m) => [`cl-${m.id}`, m.label])), 'Confirm the required items') : ''}
    <div class="stack-sm"><button class="btn btn-primary btn-block" data-action="to-checkout" ${q.purchasable && !vm.existing.length ? '' : html`disabled`}>Continue to checkout ${icon('arrow')}</button>
      <button class="btn btn-ghost btn-block" data-action="save-quote">${icon('down')} Save quote</button></div>
  </aside></div>`;
}

export function checkout(vm) {
  const { q, draft, errors, pay } = vm;
  const c = draft.contact;
  return html`<div class="page-head"><div><span class="eyebrow">Simulated checkout</span><h1>Checkout</h1><p>No real payment is taken and no card details are requested.</p></div><a class="btn btn-ghost" href="#review">Back to review</a></div>
  <div class="with-aside"><form class="stack" data-submit="pay" novalidate>
    ${errorSummary(errors)}
    ${pay.status === 'declined' ? alert('danger', 'Payment declined (simulated)', html`<p>${pay.message} Your order is saved. Choose another demo method and try again — you will not be charged twice.</p>`) : ''}
    ${pay.status === 'cancelled' ? alert('warning', 'Payment cancelled (simulated)', html`<p>${pay.message} Your order is saved. You can try again.</p>`) : ''}
    <section class="card"><h2>Receipt contact</h2><p class="small muted">Used only for the receipt. This does not create a user, an administrator or a workspace.</p>
      <div class="form-grid">${field({ id: 'name', label: 'Purchaser name', value: c.name, error: errors.name, attrs: 'autocomplete="name" data-change="contact"' })}
        ${field({ id: 'email', label: 'Receipt email', type: 'email', value: c.email, error: errors.email, attrs: 'autocomplete="email" data-change="contact"' })}
        <div class="full">${field({ id: 'company', label: 'Company name for the receipt', value: c.company, optional: true, attrs: 'autocomplete="organization" data-change="contact"' })}</div></div></section>
    <section class="card"><fieldset><legend><h2 style="margin:0">Demo payment method</h2></legend><p class="small muted">Pick an outcome to demonstrate. A real integration would hand off to a payment provider here.</p>
      <div class="stack-sm">${Object.entries(METHODS).map(([k, m]) => html`<label class="choice"><input type="radio" name="method" value="${k}" data-change="method" ${draft.ui.method === k ? html`checked` : ''}><span>${m.label}</span></label>`)}</div></fieldset></section>
    <div class="row"><button class="btn btn-primary" type="submit" id="pay-btn" ${pay.busy ? html`disabled` : ''}>${pay.busy ? 'Processing simulated payment…' : html`Pay ${money(q.totalDueMinor)} (simulated)`}</button>
      ${pay.attempts ? html`<span class="small muted">${pay.attempts} earlier attempt${pay.attempts > 1 ? 's' : ''} · same checkout session, no duplicate order</span>` : ''}</div>
    <div class="sr-only" role="status" aria-live="polite">${pay.busy ? 'Processing simulated payment' : ''}</div>
  </form><aside><section class="card"><h2>Order total</h2>
    ${q.lines.map((l) => html`<div class="sum-line small"><span>${l.skuName}<br><span class="muted">${l.components.map((x) => `${x.seats} ${x.productName}`).join(' + ')}</span></span><span class="num">${money(l.monthlyNetMinor)}/mo</span></div>`)}<hr>${totals(q)}</section></aside></div>`;
}

export function confirmation(vm) {
  const { order, persona, capacity } = vm;
  if (!order) return html`<div class="empty"><h3>No completed purchase yet</h3><p><a href="#shop">Go to the shop</a></p></div>`;
  const q = persona.id === 'carrier' ? '?p=carrier' : '';
  return html`<div class="stack" style="max-width:860px;margin:0 auto">
    <section class="card" style="text-align:center;border-top:6px solid var(--teal)"><img class="receipt-logo" src="assets/brand/veridex-logo-primary.png" alt="VeriDex Solution.AI">
      <h1 style="margin-top:var(--s4)">${icon('check')} Purchase complete</h1>
      <p class="muted">Simulated payment approved. Order <b class="mono">${order.id}</b> · reference <span class="mono">${order.paymentRef}</span> · ${date(order.createdAt)}</p>
      <div class="row" style="justify-content:center"><a class="btn btn-primary" href="onboarding.html${q}">Start onboarding ${icon('arrow')}</a><button class="btn btn-ghost" data-action="receipt">${icon('down')} Download receipt</button></div>
      <p class="small muted" style="margin-top:var(--s3)">A receipt would be emailed to ${order.contact.email} in production. No email was sent.</p></section>
    <div class="table-wrap"><table><caption>What you bought</caption><thead><tr><th scope="col">SKU</th><th scope="col">Entitlement</th><th scope="col" class="num">Monthly</th></tr></thead>
      <tbody>${order.lines.map((l) => html`<tr><th scope="row">${l.skuName}<br><span class="mono muted">${l.skuId}</span></th><td>${l.components.map((c) => html`<div>${c.seats} × ${c.productName} ${c.tierName}</div>`)}</td><td class="num">${money(l.monthlyNetMinor)}</td></tr>`)}</tbody>
      <tfoot><tr><td colspan="2">Paid today (${CADENCES[order.cadence].label.toLowerCase()}, incl. ${money(order.taxMinor)} estimated tax)</td><td class="num">${money(order.totalDueMinor)}</td></tr></tfoot></table></div>
    <section class="card"><h2>Your module capacity</h2><div class="grid g3">${capacity.map((c) => html`<div class="card tight flat stat"><b>${c.purchased}</b><span>${c.productName} ${c.tierName} seats</span></div>`)}</div></section>
    <section class="card"><h2>What happens next</h2><ol><li><b>Name your organization and workspace</b>, and nominate a free administrator.</li><li><b>Add people</b> and give each a seat in the modules they use.</li><li><b>Send invitations</b> now or later.</li><li><b>Check readiness</b> and open your administration dashboard.</li></ol>
      <a class="btn btn-primary" href="onboarding.html${q}">Start onboarding ${icon('arrow')}</a></section></div>`;
}
