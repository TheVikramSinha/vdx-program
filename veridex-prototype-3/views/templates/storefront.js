// Storefront views (tenant and carrier): shop, review, checkout, confirmation.
import { html } from './html.js';
import { icon, money, badge, alert, field, errorSummary, checklistBox, date } from './components.js';
import { product, tier, unitPrice, isFixed, offersFor, metricOf, isOneTime, kindOf, priceUnit } from '../../models/catalog.js';
import { LICENSE_METRICS } from '../../data/seedCatalog.js';
import { lessBps, bpsLabel } from '../../models/money.js';
import { CADENCES } from '../../models/pricing.js';
import { METHODS } from '../../services/paymentMock.js';

/** Licence metric badge (shown on every offer, cart line and order line). */
export const metricBadge = (metric, oneTime) => html`<span class="badge outline" title="${LICENSE_METRICS[metric]?.hint || ''}">${oneTime ? 'One-time · ' : ''}${LICENSE_METRICS[metric]?.label || metric}</span>`;
/** One-line description of what a priced line delivers. */
export function lineDetail(l) {
  if (l.usage) return `${money(l.usage.rateMinor)} per ${l.usage.unitLabel} after ${l.usage.includedUnits} included each month`;
  if (l.units != null) return `${l.units} ${l.unitLabel}${l.units === 1 ? '' : 's'}`;
  const noun = l.licenseMetric === 'per_user' ? 'user licences' : 'seats';
  return `${l.packages ? `${l.packages} pack${l.packages > 1 ? 's' : ''} → ` : ''}${l.components.map((c) => `${c.seats} ${c.productName}${l.licenseMetric === 'per_user' ? '' : ` ${c.tierName}`}`).join(' + ')}${l.licenseMetric === 'per_user' ? ` ${noun}` : ''}`;
}
const lineAmount = (l) => l.usage ? html`<span class="small muted">billed on use</span>` : l.chargeType === 'one_time' ? html`${money(l.oneTimeMinor)}<span class="muted small"> once</span>` : html`${money(l.monthlyNetMinor)}<span class="muted small">/mo</span>`;
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
  const MOD_ICON = { POL: 'doc', CLM: 'shield', LGL: 'scale', INS: 'chart', SUB: 'arrow' };
  return html`<article class="card offer ${added ? 'selected' : ''}" aria-labelledby="h-${p.id}">
    <div class="offer-top"><span class="mod-icon t${vm.cat.products.indexOf(p) % 4}">${icon(MOD_ICON[p.code] || 'box')}</span><span class="row" style="gap:8px">${added ? badge('In order', 'success', 'check') : ''}<span class="pick" aria-hidden="true">${icon('check')}</span></span></div>
    <header><div><h3 id="h-${p.id}">${p.name}</h3><p class="muted small" style="margin:0">${p.summary}</p></div></header>
    <div>${metricBadge('per_module')}</div>
    <fieldset><legend class="sr-only">${p.name} tier</legend><div class="segmented">${skus.map((x) => { const tt = tier(cat, p.id, x.components[0].tierId); return html`<label><input type="radio" name="tier-${p.id}" value="${tt.id}" data-change="tier" data-pid="${p.id}" ${tt.id === tierId ? html`checked` : ''}>${tt.name}</label>`; })}</div></fieldset>
    <div class="price"><b>${money(unit)}</b> <span class="muted small">per seat / month · illustrative</span></div>
    <ul class="feat">${t.features.map((f) => html`<li>${f}</li>`)}</ul>
    <div class="row between"><div class="field"><span class="small" style="font-weight:600" id="l-${s.id}">${p.name} seats</span>${qtyInput(`q-${s.id}-${p.id}`, seats, { label: `${p.name} seats`, sku: s.id, pid: p.id })}</div>
      <div class="num"><span class="muted small">Monthly</span><br><b>${Number.isInteger(seats) ? money(unit * seats) : '—'}</b></div></div>
    <div class="row between"><span class="mono muted">${s.id}</span><button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${s.id}">${added ? 'Update order' : 'Add to order'}</button></div>
  </article>`;
}

/** Platform user licences (licence metric: per user). */
function coreCard(vm) {
  const { cat, ui, inCart, persona } = vm;
  const s = offersFor(cat, persona.id, 'standalone').find((x) => metricOf(x) === 'per_user');
  if (!s) return '';
  const p = product(cat, s.components[0].productId), unit = unitPrice(cat, p.id, s.components[0].tierId), added = inCart[s.id];
  const n = ui.qty[s.id]?.[p.id] ?? added?.seats?.[p.id] ?? Math.max(1, ...Object.values(ui.demand).filter(Number.isInteger));
  return html`<article class="card offer ${added ? 'selected' : ''}" aria-labelledby="h-core" style="grid-column:1/-1">
    <div class="offer-top"><span class="mod-icon t2">${icon('users')}</span><span class="row" style="gap:8px">${added ? badge('In order', 'success', 'check') : vm.heldUsers ? badge(`${vm.heldUsers} held`, 'info') : cat.settings.requirePlatformLicence ? badge('Required with any module', 'warning', 'info') : ''}<span class="pick" aria-hidden="true">${icon('check')}</span></span></div>
    <div class="grid g2" style="align-items:end"><div><h3 id="h-core">${p.name} user licences</h3><p class="muted small" style="margin:0 0 10px">${s.description}</p>${metricBadge('per_user')}
      <ul class="feat" style="margin-top:12px">${p.tiers[0].features.map((f) => html`<li>${f}</li>`)}</ul></div>
      <div class="stack-sm"><div class="price"><b>${money(unit)}</b> <span class="muted small">per user / month · illustrative</span></div>
        <div class="row between"><div class="field"><span class="small" style="font-weight:600">People who will use any module</span>${qtyInput(`q-${s.id}-${p.id}`, n, { label: 'User licences', sku: s.id, pid: p.id, min: s.quantityRule.min, max: s.quantityRule.max })}</div>
          <div class="num"><span class="muted small">Monthly</span><br><b>${Number.isInteger(n) ? money(unit * n) : '—'}</b></div></div>
        <div class="row between"><span class="mono muted">${s.id}</span><button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${s.id}">${added ? 'Update order' : 'Add user licences'}</button></div></div></div>
  </article>`;
}
/** Add-ons (flat or usage) and one-time setup services. */
function addonCard(vm, s) {
  const { cat, ui, inCart } = vm;
  const p = product(cat, s.components[0].productId), unit = unitPrice(cat, p.id, s.components[0].tierId), added = inCart[s.id];
  const held = vm.held[p.id] && !isOneTime(s), metric = metricOf(s), qr = s.quantityRule;
  const units = ui.qty[s.id]?.units ?? added?.units ?? qr.min;
  const ICON = { PRT: 'users', PAY: 'cart', AI: 'compass', MIG: 'down', CFG: 'sliders', TRN: 'flag' };
  return html`<article class="card offer ${added ? 'selected' : ''}" aria-labelledby="h-${s.id}">
    <div class="offer-top"><span class="mod-icon t${kindOf(p) === 'service' ? 3 : 1}">${icon(ICON[p.code] || 'box')}</span><span class="row" style="gap:8px">${added ? badge('In order', 'success', 'check') : held ? badge('Active in workspace', 'info', 'check') : ''}<span class="pick" aria-hidden="true">${icon('check')}</span></span></div>
    <header><div><h3 id="h-${s.id}">${s.name}</h3><p class="muted small" style="margin:0">${p.summary}</p></div></header>
    <div>${metricBadge(metric, isOneTime(s))}</div>
    <p class="small muted" style="margin:0">${s.description}</p>
    <div class="price"><b>${money(unit)}</b> <span class="muted small">${priceUnit(s)} · illustrative</span>
      ${metric === 'usage' ? html`<br><span class="small">${s.usage.includedUnits} ${s.usage.unitLabel}s included each month · nothing due today</span>` : ''}</div>
    <ul class="feat">${p.tiers[0].features.map((f) => html`<li>${f}</li>`)}</ul>
    ${qr.type === 'flat' && qr.max > 1 ? html`<div class="row between"><div class="field"><span class="small" style="font-weight:600">${qr.unitLabel[0].toUpperCase() + qr.unitLabel.slice(1)}s</span>${qtyInput(`q-${s.id}-units`, units, { label: `${s.name} ${qr.unitLabel}s`, sku: s.id, pid: 'units', min: qr.min, max: qr.max })}</div>
      <div class="num"><span class="muted small">${isOneTime(s) ? 'One-time' : 'Monthly'}</span><br><b>${Number.isInteger(units) ? money(unit * units) : '—'}</b></div></div>` : ''}
    <div class="row between"><span class="mono muted">${s.id}</span>${held ? html`<span class="small muted">Already active — workspace-wide</span>` : html`<button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${s.id}">${added ? 'Update order' : 'Add to order'}</button>`}</div>
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
    <div>${metricBadge('per_module')}</div>
    <p class="small" style="margin:0"><b>${fixed ? 'Each pack includes set seats per module.' : 'You choose a separate seat count for each module.'}</b> Every module keeps its own limit; seats are never shared. VeriDex Core user licences are bought separately.</p>
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
  const prods = cat.products.filter((p) => p.status === 'active' && kindOf(p) === 'module' && p.personas.includes(vm.persona.id));
  return html`<section class="card" aria-labelledby="need-h">
    <div class="panel-title"><h3 id="need-h">Seats needed per module</h3><button class="btn-link" data-action="example">Try the 10 Claims + 4 Legal example</button></div>
    <p class="small muted">Counts only. We ask who these people are after purchase. Leave a module at 0 if you do not need it. Module seats only: “Use this” also adds VeriDex Core user licences for the largest module count, which you can change.</p>
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
  const { q, cat, draft } = vm;
  const groups = [['Licences', q.lines.filter((l) => l.chargeType !== 'one_time' && !l.usage)], ['Usage-based (billed on use)', q.lines.filter((l) => l.usage)], ['One-time setup', q.lines.filter((l) => l.chargeType === 'one_time')]].filter(([, ls]) => ls.length);
  return html`<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">Your order</h2>
    <div class="sum-line small" style="padding-top:0"><span>${icon('user')} ${draft.contact.name}${draft.contact.company ? `, ${draft.contact.company}` : ''}</span><a href="#start" class="small">Change</a></div>
    ${!q.lines.length ? html`<p class="muted">Nothing added yet. Choose modules, a bundle or add-ons.</p>` : html`
    ${groups.map(([g, ls]) => html`<h3 class="small" style="margin:14px 0 0;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-2)">${g}</h3>${ls.map((l) => html`<div class="cart-line"><div class="row between"><b>${l.skuName}</b><span class="num">${lineAmount(l)}</span></div>
      <span class="small muted">${lineDetail(l)}</span>
      <div class="row between"><span>${metricBadge(l.licenseMetric, l.chargeType === 'one_time')} <span class="mono muted">${l.skuId}</span></span><button class="btn-link" data-action="remove" data-id="${l.skuId}">Remove<span class="sr-only"> ${l.skuName}</span></button></div></div>`)}`)}
    ${conflictAlerts(vm)}
    ${q.capacity.length ? html`<h3 style="margin-top:var(--s4)">Capacity you will receive</h3>
    <ul class="small" style="list-style:none;padding:0">${q.capacity.map((c) => html`<li class="sum-line"><span>${c.productName} <span class="muted">${c.licenseMetric === 'per_user' ? 'user licences' : Object.values(c.tiers).join(' / ')}</span></span><b>${c.seats} ${c.licenseMetric === 'per_user' ? (c.seats === 1 ? 'user' : 'users') : (c.seats === 1 ? 'seat' : 'seats')}</b></li>`)}
      ${q.addons.map((a) => html`<li class="sum-line"><span>${a.productName}</span><b>Workspace-wide</b></li>`)}</ul>` : ''}
    <fieldset style="margin:var(--s3) 0"><legend>Billing</legend><div class="segmented">${Object.entries(CADENCES).map(([k, c]) => html`<label><input type="radio" name="cadence" value="${k}" data-change="cadence" ${q.cadence === k ? html`checked` : ''}>${c.label}${k === 'annual' ? html` <span class="small">−${bpsLabel(cat.settings.annualDiscountBps)}</span>` : ''}</label>`)}</div></fieldset>
    ${totals(q)}
    <a class="btn btn-primary btn-block" href="#review" style="margin-top:var(--s3)" ${q.purchasable ? '' : html`aria-disabled="true" data-action="noop"`}>Review order ${icon('arrow')}</a>`}
    <p class="small muted" style="margin:var(--s3) 0 0">${icon('lock')} Your team's names and emails are only needed after purchase.</p></section>`;
}
export function conflictAlerts(vm) {
  const { q, existing } = vm;
  return html`${q.errors.map((e) => alert('danger', e))}
    ${q.warnings.map((w) => alert('warning', w))}
    ${q.conflicts.map((c) => alert('danger', `${c.productName} is in your order at two tiers`, html`<p class="small">${c.sources.map((s) => `${s.skuName} (${s.tierName})`).join(' and ')}. One module runs at one tier. Remove one of them to continue.</p><div class="row">${c.sources.map((s) => html`<button class="btn btn-ghost btn-sm" data-action="remove" data-id="${s.skuId}">Remove ${s.skuName}</button>`)}</div>`))}
    ${q.overlaps.map((c) => alert('info', `${c.productName}: capacity adds up`, html`<p class="small">${c.sources.map((s) => `${s.seats} from ${s.skuName}`).join(' + ')} = <b>${c.seats} ${c.productName} seats</b>. Each line is charged once.</p>`))}
    ${existing.map((m) => alert('danger', m))}`;
}
export function totals(q) {
  return html`<div>
    ${q.bundleSavingMinor ? html`<div class="sum-line small"><span>Individual list price / month</span><span class="num"><s>${money(q.monthlyListMinor)}</s></span></div><div class="sum-line small"><span>Bundle saving / month</span><span class="num">−${money(q.bundleSavingMinor)}</span></div>` : ''}
    <div class="sum-line"><span>Licence fees / month</span><span class="num">${money(q.monthlyNetMinor)}</span></div>
    ${q.monthlyNetMinor ? html`<div class="sum-line small"><span>Hosted access &amp; support (SMA), ${bpsLabel(q.smaBps)} of licence fees</span><span class="num">${money(q.smaMonthlyMinor)}</span></div>
    <div class="sum-line"><span>Recurring / month</span><span class="num">${money(q.recurringMonthlyMinor)}</span></div>` : ''}
    ${q.cadence === 'annual' && q.monthlyNetMinor ? html`<div class="sum-line small"><span>12 months</span><span class="num">${money(q.periodGrossMinor)}</span></div><div class="sum-line small"><span>Annual prepay discount (${bpsLabel(q.annualDiscountBps)})</span><span class="num">−${money(q.cadenceDiscountMinor)}</span></div>
      <div class="sum-line small muted"><span>Monthly equivalent</span><span class="num">${money(q.monthlyEquivalentMinor)}</span></div>` : ''}
    ${q.oneTimeMinor ? html`<div class="sum-line"><span>One-time setup (charged once)</span><span class="num">${money(q.oneTimeMinor)}</span></div>` : ''}
    ${q.usageTerms.length ? html`<div class="sum-line small muted"><span>Usage-based add-ons</span><span class="num">$0.00 today</span></div>` : ''}
    <div class="sum-line small"><span>Estimated tax (${bpsLabel(q.taxBps)}, demo rate)</span><span class="num">${money(q.taxMinor)}</span></div>
    <div class="sum-line total"><span>Due today</span><span class="num">${money(q.totalDueMinor)}</span></div>
    <p class="small muted" style="margin:4px 0 0">${q.monthlyNetMinor ? (q.cadence === 'annual' ? 'Recurring charges prepaid for 12 months, then renew yearly.' : 'Recurring charges renew each month.') : ''}${q.oneTimeMinor ? ' Setup services are charged once.' : ''}${q.usageTerms.length ? ' Usage is billed monthly in arrears.' : ''} USD. Illustrative prices.</p></div>`;
}

/** Contact details first: captured before any product can be selected, so an abandoned cart can be followed up (only with permission). */
export function start(vm) {
  const { persona, draft, errors } = vm, c = draft.contact || {};
  return html`<section class="hero"><div><span class="eyebrow">${persona.label}</span><h1>${persona.hero.title}</h1><p class="lead">${persona.hero.lead}</p></div>
    <ul>${persona.proof.map((x) => html`<li>${icon('check')} ${x}</li>`)}</ul></section>
  <div class="with-aside"><form class="card stack" data-submit="start-contact" novalidate aria-labelledby="start-h">
    <div><span class="eyebrow">Step 1 of 2 · About you</span><h2 id="start-h" style="font-size:1.5rem">Before you choose products</h2>
      <p class="muted" style="margin:0">Tell us who is buying. We use this for your quote and receipt${c.capturedAt ? '' : ', and to save your cart'}. Your team's names come later, after purchase.</p></div>
    ${errorSummary(errors)}
    <div class="form-grid">${field({ id: 'start-name', label: 'Your name', value: c.name, error: errors['start-name'], attrs: 'autocomplete="name"' })}
      ${field({ id: 'start-email', label: 'Work email', type: 'email', value: c.email, error: errors['start-email'], attrs: 'autocomplete="email"' })}
      ${field({ id: 'start-company', label: 'Company', value: c.company, error: errors['start-company'], attrs: 'autocomplete="organization"' })}
      ${field({ id: 'start-phone', label: 'Phone', value: c.phone, optional: true, error: errors['start-phone'], attrs: 'autocomplete="tel" inputmode="tel"' })}
      <div class="full">${field({ id: 'start-title', label: 'Job title', value: c.jobTitle, optional: true, attrs: 'autocomplete="organization-title"' })}</div></div>
    <label class="choice"><input type="checkbox" id="start-consent" name="start-consent" ${c.followUpConsent ? html`checked` : ''}><span><b>VeriDex may contact me about this quote</b><br><span class="small muted">If I leave before finishing, a specialist may email or call me about my cart. Optional — you can still buy without it.</span></span></label>
    <div class="row"><button class="btn btn-primary" type="submit">${c.capturedAt ? 'Save and return to products' : 'Continue to products'} ${icon('arrow')}</button>${c.capturedAt ? html`<a class="btn btn-ghost" href="#shop">Cancel</a>` : ''}</div>
    <p class="small muted" style="margin:0">${icon('lock')} Demo: stored only in this browser. Nothing is sent.</p></form>
    <aside><section class="card tight flat"><h3>What happens next</h3><ol class="small"><li>Choose modules, user licences, add-ons and setup services</li><li>Review and pay (simulated)</li><li>Set up your workspace and invite your team</li></ol></section>
      <section class="card tight"><h3>Not ready to buy?</h3><p class="small">Get guidance without starting a cart.</p><a class="btn btn-secondary btn-sm" href="assistance.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Expert guidance</a></section></aside></div>`;
}

export function shop(vm) {
  const { persona, cat, ui } = vm;
  const tab = ui.tab;
  const prods = cat.products.filter((p) => p.status === 'active' && kindOf(p) === 'module' && p.personas.includes(persona.id));
  const bundles = offersFor(cat, persona.id, 'bundle').sort((a, b) => (b.id === persona.featured) - (a.id === persona.featured));
  const extras = offersFor(cat, persona.id, 'standalone').filter((x) => ['flat', 'usage'].includes(metricOf(x)));
  const addons = extras.filter((x) => !isOneTime(x)), services = extras.filter(isOneTime);
  const T = [['modules', 'Modules & users', 'User licences and per-seat modules.'], ['bundles', 'Product bundles', 'Several modules, one SKU, lower price.'], ['addons', 'Add-ons & setup', 'Flat, usage and one-time services.'], ['guidance', 'Expert guidance', 'Not sure? Get help choosing.']];
  return html`
  <section class="hero"><div><span class="eyebrow">${persona.label}</span><h1>${persona.hero.title}</h1><p class="lead">${persona.hero.lead}</p>
    <div class="row"><a class="btn btn-secondary" href="assistance.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Get expert guidance</a>${vm.hasSubscription ? html`<a class="btn btn-ghost" href="tenant-admin.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Manage your subscription</a>` : ''}</div></div>
    <ul>${persona.proof.map((x) => html`<li>${icon('check')} ${x}</li>`)}</ul></section>
  ${vm.hasSubscription ? alert('info', 'This demo workspace already has a subscription.', html`<p class="small">A new order adds capacity to modules at the same tier. To add seats to one module, Tenant Admin → Billing is quicker.</p>`) : ''}
  <div class="offer-tabs" role="tablist" aria-label="How would you like to buy?">${T.map(([k, a, b]) => html`<button role="tab" id="tab-${k}" aria-selected="${String(tab === k)}" aria-controls="offers" data-action="tab" data-id="${k}"><b>${a}</b><span>${b}</span></button>`)}</div>
  <div class="with-aside"><div class="stack" id="offers" role="tabpanel" aria-labelledby="tab-${tab}">
    ${tab === 'modules' ? html`<div class="grid g2">${coreCard(vm)}${prods.map((p) => moduleCard(vm, p))}</div>
      <details class="card tight"><summary><b>Compare tiers</b></summary><div class="table-wrap" style="margin-top:var(--s3)"><table><thead><tr><th scope="col">Module</th><th scope="col">Tier</th><th scope="col">Includes</th><th scope="col" class="num">Per seat / month</th></tr></thead>
        <tbody>${prods.flatMap((p) => p.tiers.map((t) => html`<tr><th scope="row">${p.name}</th><td>${t.name}</td><td class="small">${t.features.join(' · ')}</td><td class="num">${unitPrice(cat, p.id, t.id) ? money(unitPrice(cat, p.id, t.id)) : '—'}</td></tr>`))}</tbody></table></div></details>` : ''}
    ${tab === 'bundles' ? html`${demandTool(vm)}${bundles.length ? bundles.map((s) => bundleCard(vm, s)) : html`<div class="empty"><h3>No bundles are published for this journey</h3><p>Choose individual modules, or ask for guidance.</p></div>`}` : ''}
    ${tab === 'addons' ? html`<div class="panel-title"><h2>Add-ons</h2><span class="small muted">Workspace-wide · no per-person seat</span></div>
      <div class="grid g2">${addons.map((x) => addonCard(vm, x))}</div>
      <div class="panel-title" style="margin-top:12px"><h2>One-time setup services</h2><span class="small muted">Charged once · not part of your subscription · no SMA</span></div>
      <div class="grid g2">${services.map((x) => addonCard(vm, x))}</div>` : ''}
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
    <div class="table-wrap"><table><caption>Order lines</caption><thead><tr><th scope="col">SKU</th><th scope="col">Licence metric</th><th scope="col">What you get</th><th scope="col" class="num">Qty</th><th scope="col" class="num">List / unit</th><th scope="col" class="num">Your price / unit</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${q.lines.map((l) => l.components.map((c, i) => html`<tr>${i === 0 ? html`<th scope="rowgroup" rowspan="${l.components.length}"><b>${l.skuName}</b><br><span class="mono muted">${l.skuId}</span><br>${badge(l.skuType === 'bundle' ? (l.packages ? `Fixed pack × ${l.packages}` : `Bundle · ${bpsLabel(l.discountBps)} off`) : l.chargeType === 'one_time' ? 'Setup service' : c.kind === 'addon' ? 'Add-on' : c.kind === 'platform' ? 'Platform access' : 'Individual module', l.skuType === 'bundle' ? 'info' : 'outline')}</th>
          <td rowspan="${l.components.length}">${metricBadge(l.licenseMetric, l.chargeType === 'one_time')}</td>` : ''}
        <td>${c.productName} ${c.kind === 'module' ? html`<span class="muted">${c.tierName}</span>` : ''}${l.usage ? html`<br><span class="small muted">${l.usage.includedUnits} ${l.usage.unitLabel}s included / month</span>` : ''}</td>
        <td class="num">${c.seats ?? c.units ?? '—'}</td><td class="num">${money(c.unitListMinor)}${l.usage ? html`<br><span class="small muted">per ${l.usage.unitLabel}</span>` : ''}</td><td class="num">${c.unitNetMinor == null ? html`<span class="small muted">pack price</span>` : money(c.unitNetMinor)}</td>
        ${i === 0 ? html`<td class="num" rowspan="${l.components.length}"><b>${lineAmount(l)}</b>${l.monthlySavingMinor ? html`<br><span class="small muted">saves ${money(l.monthlySavingMinor)} vs individual</span>` : ''}</td>` : ''}</tr>`))}</tbody></table></div>
    <section class="card"><h2>What your workspace receives</h2><p class="small muted">Each module has its own seat limit; a person who uses two modules needs a seat in each. Each person with any module seat also needs one VeriDex Core user licence. The workspace administrator is free and uses neither.</p>
      <div class="grid g3">${q.capacity.map((c) => html`<div class="card tight flat stat"><b>${c.seats}</b><span>${c.licenseMetric === 'per_user' ? `${c.productName} user licences` : `${c.productName} ${Object.values(c.tiers).join(' / ')} seats`}</span></div>`)}
        ${q.addons.map((a) => html`<div class="card tight flat stat"><b style="font-size:1.1rem">Workspace-wide</b><span>${a.productName} · ${a.licenseMetric === 'usage' ? 'usage-based' : 'flat fee'}</span></div>`)}
        ${q.services.map((sv) => html`<div class="card tight flat stat"><b style="font-size:1.1rem">${sv.units} ${sv.unitLabel}${sv.units === 1 ? '' : 's'}</b><span>${sv.productName} · one-time, scheduled after purchase</span></div>`)}</div></section>
    <section class="card"><h2>Billing commitment</h2><dl class="kv"><dt>Cadence</dt><dd>${CADENCES[q.cadence].label}</dd><dt>First charge</dt><dd>${money(q.totalDueMinor)} today (simulated)</dd><dt>Renews</dt><dd>${date(vm.renewsAt)} for ${money(q.recurringPeriodMinor + Math.round(q.recurringPeriodMinor * q.taxBps / 10000))} incl. tax, unless changed · estimate</dd>
      <dt>Hosted access &amp; support</dt><dd>SMA ${bpsLabel(q.smaBps)} of licence fees (${money(q.smaMonthlyMinor)} / month) — cloud hosting, maintenance, upgrades and support. Tied to your licences: it changes when licences change.</dd>
      ${q.oneTimeMinor ? html`<dt>One-time setup</dt><dd>${money(q.oneTimeMinor)} charged once today. Not renewed, no SMA, no annual discount.</dd>` : ''}
      ${q.usageTerms.length ? html`<dt>Usage-based</dt><dd>${q.usageTerms.map((u) => `${u.skuName}: ${money(u.rateMinor)} per ${u.unitLabel} after ${u.includedUnits} included each month`).join('; ')}. Billed monthly in arrears; nothing due today.</dd>` : ''}
      <dt>Unused seats</dt><dd>Stay paid until you reduce purchased seats or user licences in Tenant Admin</dd><dt>Adding seats later</dt><dd>Separate purchase with an illustrative prorated price, plus SMA on the added licences</dd></dl></section>
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
    <section class="card"><h2>Receipt contact</h2><p class="small muted">From the details you gave at the start. Used for the receipt. This does not create a user, an administrator or a workspace.</p>
      <div class="form-grid">${field({ id: 'name', label: 'Purchaser name', value: c.name, error: errors.name, attrs: 'autocomplete="name" data-change="contact"' })}
        ${field({ id: 'email', label: 'Receipt email', type: 'email', value: c.email, error: errors.email, attrs: 'autocomplete="email" data-change="contact"' })}
        <div class="full">${field({ id: 'company', label: 'Company name for the receipt', value: c.company, optional: true, attrs: 'autocomplete="organization" data-change="contact"' })}</div></div></section>
    <section class="card"><fieldset><legend><h2 style="margin:0">Demo payment method</h2></legend><p class="small muted">Pick an outcome to demonstrate. A real integration would hand off to a payment provider here.</p>
      <div class="stack-sm">${Object.entries(METHODS).map(([k, m]) => html`<label class="choice"><input type="radio" name="method" value="${k}" data-change="method" ${draft.ui.method === k ? html`checked` : ''}><span>${m.label}</span></label>`)}</div></fieldset></section>
    <div class="row"><button class="btn btn-primary" type="submit" id="pay-btn" ${pay.busy ? html`disabled` : ''}>${pay.busy ? 'Processing simulated payment…' : html`Pay ${money(q.totalDueMinor)} (simulated)`}</button>
      ${pay.attempts ? html`<span class="small muted">${pay.attempts} earlier attempt${pay.attempts > 1 ? 's' : ''} · same checkout session, no duplicate order</span>` : ''}</div>
    <div class="sr-only" role="status" aria-live="polite">${pay.busy ? 'Processing simulated payment' : ''}</div>
  </form><aside><section class="card"><h2>Order total</h2>
    ${q.lines.map((l) => html`<div class="sum-line small"><span>${l.skuName}<br><span class="muted">${lineDetail(l)}</span></span><span class="num">${lineAmount(l)}</span></div>`)}<hr>${totals(q)}</section></aside></div>`;
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
    <div class="table-wrap"><table><caption>What you bought</caption><thead><tr><th scope="col">SKU</th><th scope="col">Licence metric</th><th scope="col">Entitlement</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${order.lines.map((l) => html`<tr><th scope="row">${l.skuName}<br><span class="mono muted">${l.skuId}</span></th><td>${metricBadge(l.licenseMetric, l.chargeType === 'one_time')}</td><td>${lineDetail(l)}</td><td class="num">${lineAmount(l)}</td></tr>`)}
        ${order.smaMonthlyMinor ? html`<tr><th scope="row">Hosted access &amp; support (SMA)</th><td><span class="badge outline">${bpsLabel(order.smaBps)} of licences</span></td><td>Cloud hosting, maintenance, upgrades, support</td><td class="num">${money(order.smaMonthlyMinor)}<span class="muted small">/mo</span></td></tr>` : ''}</tbody>
      <tfoot><tr><td colspan="3">Paid today (${CADENCES[order.cadence].label.toLowerCase()}${order.oneTimeMinor ? `, incl. ${money(order.oneTimeMinor)} one-time setup` : ''}, incl. ${money(order.taxMinor)} estimated tax)</td><td class="num">${money(order.totalDueMinor)}</td></tr></tfoot></table></div>
    <section class="card"><h2>Your workspace capacity</h2><div class="grid g3">${capacity.map((c) => html`<div class="card tight flat stat"><b style="${c.purchased == null ? 'font-size:1.1rem' : ''}">${c.purchased ?? 'Workspace-wide'}</b><span>${c.licenseMetric === 'per_user' ? `${c.productName} user licences` : c.purchased == null ? c.productName : `${c.productName} ${c.tierName} seats`}</span></div>`)}</div></section>
    <section class="card"><h2>What happens next</h2><ol><li><b>Name your organization and workspace</b>, and nominate a free administrator.</li><li><b>Add people</b> and give each a seat in the modules they use.</li><li><b>Send invitations</b> now or later.</li><li><b>Check readiness</b> and open your administration dashboard.</li></ol>
      <a class="btn btn-primary" href="onboarding.html${q}">Start onboarding ${icon('arrow')}</a></section></div>`;
}
