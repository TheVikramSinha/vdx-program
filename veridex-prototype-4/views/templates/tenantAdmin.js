// Tenant Admin (customer-side) views: capacity, people, invitations, billing, activity.
import { html } from './html.js';
import { icon, badge, alert, capacityCard, addonCard, capacityLegend, memberBadge, date, dateTime, money } from './components.js';
import { usageEstimate, SERVICE_STATUS } from '../../models/orders.js';
import { pctBps, bpsLabel } from '../../models/money.js';
import { MEMBER_TYPES, STATUS, seatsOf, liveMembers } from '../../models/licensing.js';
import { CADENCES } from '../../models/pricing.js';

export const TABS = [['overview', 'Overview', 'box'], ['people', 'People & access', 'user'], ['invitations', 'Invitations', 'mail'], ['billing', 'Plan & billing', 'shield'], ['activity', 'Activity', 'clock']];
export function empty(persona) {
  return html`<div class="empty"><h3>No subscription in this ${persona.short.toLowerCase()} workspace yet</h3><p>Capacity, people and billing appear here after a purchase.</p>
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${persona.home}">Go to the shop</a><button class="btn btn-ghost" data-action="demo-tools">Load a demo scenario</button></div></div>`;
}
function overview(vm) {
  const { ws, cap, totals, persona } = vm;
  const expired = ws.members.filter((m) => m.status === 'expired'), full = cap.filter((c) => c.available === 0);
  const seatCap = cap.filter((c) => c.purchased != null), addons = cap.filter((c) => c.purchased == null).map((c) => ({ ...c, poolName: ws.pools?.[c.poolId]?.name }));
  const renew = ws.subscriptions[0]?.renewsAt;
  return html`<div class="stack">
    ${!ws.onboarding.completedAt ? alert('warning', 'Onboarding is not finished.', html`<p class="small"><a href="onboarding.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Continue onboarding</a> to name the workspace and nominate an administrator.</p>`) : ''}
    ${full.map((c) => c.kind === 'pool'
      ? alert('warning', `${c.productName} bundle seats are all used (${c.purchased} of ${c.purchased}).`, html`<p class="small">New assignments to ${c.productNames.join(', ')} are blocked. <button class="btn-link" data-action="buy" data-id="${c.productId}">Buy bundle seats</button></p>`)
      : alert('warning', `${c.productName}${c.kind === 'platform' ? ' user licences are' : ' is'} full (${c.purchased} of ${c.purchased}).`, html`<p class="small">${c.kind === 'platform' ? 'Nobody new can get module access.' : `New ${c.productName} assignments are blocked. Seats in other modules cannot be used.`} <button class="btn-link" data-action="buy" data-id="${c.productId}">Buy ${c.kind === 'platform' ? 'user licences' : `${c.productName} seats`}</button></p>`))}
    ${expired.length ? alert('warning', `${expired.length} expired invitation${expired.length > 1 ? 's are' : ' is'} holding seats.`, html`<p class="small"><a href="#invitations">Resend or revoke</a> to use or release them.</p>`) : ''}
    <div class="grid g4"><div class="card tight stat"><b>${totals.people}</b><span>People (distinct)</span></div><div class="card tight stat"><b>${totals.seatsUsed} / ${totals.seatsPurchased}</b><span>Module seats in use</span></div>
      ${totals.usersPurchased != null ? html`<div class="card tight stat"><b>${totals.usersUsed} / ${totals.usersPurchased}</b><span>User licences in use · admins free</span></div>` : html`<div class="card tight stat"><b>${totals.admins}</b><span>Administrators · free, no seat</span></div>`}<div class="card tight stat"><b>${date(renew)}</b><span>Next renewal</span></div></div>
    <section><div class="panel-title"><h2>Seats and user licences</h2>${capacityLegend()}</div>
      <div class="grid g3">${seatCap.map((c) => capacityCard(c, html`<div class="row between"><span class="small muted">${c.enabled ? 'Enabled' : 'Disabled'} · ${c.visible ? 'Visible' : 'Hidden'}</span><button class="btn btn-secondary btn-sm" data-action="buy" data-id="${c.productId}">${c.kind === 'platform' ? 'Buy user licences' : c.kind === 'pool' ? 'Buy bundle seats' : 'Buy seats'}</button></div>`))}</div>
      <p class="small muted" style="margin-top:var(--s3)">Per-seat modules keep their own limits; bundle seats are shared by that bundle’s modules (one seat per person–module assignment). People counts and seat counts differ because one person can hold seats in several modules. Each person with any module seat uses one user licence.</p></section>
    ${addons.length ? html`<section><div class="panel-title"><h2>Other licences</h2><span class="small muted">No seat limit of their own: per module, per usage, custom metrics, add-ons, and modules that draw on a bundle pool</span></div><div class="grid g3">${addons.map((c) => addonCard(c))}</div></section>` : ''}
    <section class="card"><div class="panel-title"><h2>Workspace administrator role</h2>${badge('Free · no seat', 'success', 'shield')}</div>
      <p class="small">Administrators manage billing, people, invitations and seats. The role gives no module access on its own.</p>
      <ul>${liveMembers(ws).filter((m) => m.isAdmin).map((m) => html`<li><b>${m.name}</b> · ${seatsOf(ws, m.id).length ? `also holds ${seatsOf(ws, m.id).map((s) => ws.entitlements[s.productId].productName).join(', ')} seat(s)` : 'holds no module seat'}</li>`)}</ul></section></div>`;
}
function people(vm) {
  const { ws, cap, filter } = vm;
  const q = filter.q.trim().toLowerCase();
  const list = ws.members.filter((m) => (filter.status === 'all' ? m.status !== 'revoked' : m.status === filter.status) && (!q || `${m.name} ${m.email}`.toLowerCase().includes(q)) && (filter.module === 'all' || seatsOf(ws, m.id).some((s) => s.productId === filter.module)));
  return html`<div class="stack">
    <div class="row" style="align-items:flex-end"><div class="field grow"><label for="f-q">Search people</label><input type="search" id="f-q" value="${filter.q}" data-change="filter" placeholder="Name or email"></div>
      <div class="field"><label for="f-status">Status</label><select id="f-status" data-change="filter"><option value="all">All current</option>${Object.entries(STATUS).map(([k, l]) => html`<option value="${k}" ${filter.status === k ? html`selected` : ''}>${l}</option>`)}</select></div>
      <div class="field"><label for="f-module">Module</label><select id="f-module" data-change="filter"><option value="all">Any</option>${cap.filter((c) => c.kind === 'module').map((c) => html`<option value="${c.productId}" ${filter.module === c.productId ? html`selected` : ''}>${c.productName}</option>`)}</select></div>
      <button class="btn btn-primary" data-action="add-member">Add person</button></div>
    ${!list.length ? html`<div class="empty"><h3>No people match</h3><p>${ws.members.length ? 'Change the search or filters.' : 'Add your first person to assign seats.'}</p></div>` : html`
    <div class="table-wrap"><table><caption>${list.length} ${list.length === 1 ? 'person' : 'people'}</caption><thead><tr><th scope="col">Person</th><th scope="col">Status</th><th scope="col">Module seats</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${list.map((m) => html`<tr><th scope="row">${m.name} ${m.isAdmin ? badge('Admin · free', 'success', 'shield') : ''}<br><span class="small muted">${m.email} · ${MEMBER_TYPES[m.type]} · <span class="mono">${m.id}</span></span></th>
        <td>${memberBadge(m.status)}</td><td>${seatsOf(ws, m.id).map((s) => html`<div>${ws.entitlements[s.productId].productName} · ${s.role}</div>`)}${!seatsOf(ws, m.id).length ? html`<span class="muted">None</span>` : ''}</td>
        <td class="actions">${m.status === 'revoked' ? '' : html`<button class="btn btn-ghost btn-sm" data-action="member" data-id="${m.id}">Manage<span class="sr-only"> ${m.name}</span></button>`}</td></tr>`)}</tbody></table></div>`}</div>`;
}
function invites(vm) {
  const { ws } = vm;
  const list = ws.members.filter((m) => ['draft', 'invited', 'expired'].includes(m.status));
  return html`<div class="stack">${alert('info', 'Seat policy (demo)', html`<ul class="small"><li>Not-invited and pending people <b>reserve</b> their seats.</li><li>Accepting converts the same reservation to an assigned seat — never counted twice.</li><li>Expired invitations keep the reservation until you resend or revoke. Proposed production rule: auto-release 14 days after expiry.</li><li>Suspended people keep their seats; remove module access to free them.</li></ul>`)}
    ${!list.length ? html`<div class="empty"><h3>No open invitations</h3><p>Everyone is active, or no one has been added yet.</p></div>` : html`
    <div class="table-wrap"><table><thead><tr><th scope="col">Person</th><th scope="col">Reserved seats</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${list.map((m) => html`<tr><th scope="row">${m.name}<br><span class="small muted">${m.email}</span></th><td>${seatsOf(ws, m.id).map((s) => ws.entitlements[s.productId].productName).join(', ') || html`<span class="muted">None</span>`}</td>
        <td>${memberBadge(m.status)}${m.invite ? html`<br><span class="small muted">${m.status === 'expired' ? 'Expired' : 'Expires'} ${date(m.invite.expiresAt)} · sent ${m.invite.count}×</span>` : ''}</td>
        <td class="actions"><button class="btn-link" data-action="invite" data-id="${m.id}">${m.status === 'draft' ? 'Send' : 'Resend'}</button> <button class="btn-link" data-action="revoke" data-id="${m.id}">Revoke</button>
          ${m.status === 'invited' ? html`<br><span class="small muted">Demo:</span> <button class="btn-link" data-action="sim-accept" data-id="${m.id}">Simulate accept</button> <button class="btn-link" data-action="sim-expire" data-id="${m.id}">Simulate expiry</button>` : ''}</td></tr>`)}</tbody></table></div>`}</div>`;
}
function billing(vm) {
  const { ws, cap, orders } = vm;
  const recurring = ws.subscriptions.filter((x) => !x.usage);
  const monthly = recurring.reduce((n, x) => n + x.monthlyNetMinor, 0), sma = recurring.reduce((n, x) => n + pctBps(x.monthlyNetMinor, x.smaBps || 0), 0), sub = ws.subscriptions[0];
  const smaRate = sub?.smaBps || 0, usage = cap.filter((c) => c.usage), services = ws.services || [];
  return html`<div class="stack">
    <div class="grid g4"><div class="card tight stat"><b>${CADENCES[sub.cadence].label}</b><span>Billing cadence</span></div><div class="card tight stat"><b>${date(sub.renewsAt)}</b><span>Next renewal</span></div>
      <div class="card tight stat"><b>${money(monthly)}</b><span>Licence fees / month at purchase prices</span></div><div class="card tight stat"><b>${money(sma)}</b><span>Hosted access &amp; support (SMA) / month · ${bpsLabel(smaRate)} of licences</span></div></div>
    <div class="table-wrap"><table><caption>Subscription lines (as purchased — later catalog changes do not alter these)</caption><thead><tr><th scope="col">SKU</th><th scope="col">Licence metric</th><th scope="col">Entitlement</th><th scope="col">Catalog version</th><th scope="col" class="num">Monthly</th></tr></thead>
      <tbody>${ws.subscriptions.map((x) => html`<tr><th scope="row">${x.skuName}<br><span class="mono muted">${x.skuId}</span>${x.skuType === 'bundle' ? html`<br>${badge('Bundle', 'info')}` : ''}</th><td><span class="badge outline">${x.metricLabel}</span>${x.isCustomMetric ? html` ${badge('New / custom', 'info')}` : ''}</td>
        <td>${x.usage ? html`${money(x.usage.rateMinor)} per ${x.usage.unitLabel} after ${x.usage.includedUnits} included / month` : x.bundleSeats != null ? html`${x.bundleSeats} shared bundle seats · ${x.components.map((c) => c.productName).join(', ')}` : x.units != null ? html`${x.units} ${x.unitLabel}${x.units === 1 ? '' : 's'} · ${x.components[0].productName}${x.components[0].kind === 'module' ? ' (any number of users)' : ''}` : x.components.map((c) => html`<div>${c.seats} × ${c.productName}${c.kind === 'platform' ? ' user licences' : ` ${c.tierName}`}${c.unitNetMinor != null ? html` <span class="small muted">@ ${money(c.unitNetMinor)}</span>` : ''}</div>`)}</td><td>v${x.catalogVersion}</td>
        <td class="num">${x.usage ? html`<span class="small muted">billed on use</span>` : money(x.monthlyNetMinor)}</td></tr>`)}</tbody>
      <tfoot><tr><td colspan="4">Hosted access &amp; support (SMA), ${bpsLabel(smaRate)} of licence fees — cloud hosting, maintenance, upgrades, support</td><td class="num">${money(sma)}</td></tr></tfoot></table></div>
    <div class="table-wrap"><table><caption>Seats, bundle seat pools and user licences</caption><thead><tr><th scope="col">Licence</th><th scope="col">Metric</th><th scope="col" class="num">Purchased</th><th scope="col" class="num">In use or reserved</th><th scope="col" class="num">Unassigned (still paid)</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${cap.filter((c) => c.purchased != null).map((c) => html`<tr><th scope="row">${c.productName} <span class="muted small">${c.kind === 'platform' ? 'user licences' : c.kind === 'pool' ? `bundle seats · ${c.productNames.join(', ')}` : c.tierName}</span></th><td><span class="badge outline">${c.kind === 'platform' ? 'Per user' : c.metricLabel}</span></td><td class="num">${c.purchased}</td><td class="num">${c.assigned + c.reserved}</td><td class="num">${c.available}</td>
        <td class="actions"><button class="btn btn-secondary btn-sm" data-action="buy" data-id="${c.productId}">${c.kind === 'platform' ? 'Buy user licences' : c.kind === 'pool' ? 'Buy bundle seats' : 'Buy seats'}</button> <button class="btn btn-ghost btn-sm" data-action="reduce" data-id="${c.productId}" ${c.available ? '' : html`disabled`}>Reduce</button></td></tr>`)}</tbody></table></div>
    ${usage.length ? html`<div class="table-wrap"><table><caption>Usage this period (simulated meter)</caption><thead><tr><th scope="col">Product</th><th scope="col">Rate</th><th scope="col" class="num">Included</th><th scope="col" class="num">Used</th><th scope="col" class="num">Billable</th><th scope="col" class="num">Estimated charge</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${usage.map((c) => { const e = usageEstimate(c.usage); return html`<tr><th scope="row">${c.productName}</th><td>${money(c.usage.rateMinor)} per ${c.usage.unitLabel}</td><td class="num">${c.usage.includedUnits}</td><td class="num">${c.usage.used}</td><td class="num">${e.billable}</td><td class="num">${money(e.amountMinor)}</td>
        <td class="actions"><button class="btn btn-ghost btn-sm" data-action="usage" data-id="${c.productId}" data-arg="25">Simulate +25</button></td></tr>`; })}</tbody></table></div>
      <p class="small muted" style="margin-top:-8px">Usage is billed monthly in arrears; no usage charge was taken at purchase. No SMA on usage.</p>` : ''}
    ${services.length ? html`<div class="table-wrap"><table><caption>One-time setup services</caption><thead><tr><th scope="col">Service</th><th scope="col">Quantity</th><th scope="col">Order</th><th scope="col" class="num">Paid once</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${services.map((x) => html`<tr><th scope="row">${x.skuName}<br><span class="mono muted">${x.skuId}</span></th><td>${x.units} ${x.unitLabel}${x.units === 1 ? '' : 's'}</td><td class="mono">${x.orderId}</td><td class="num">${money(x.amountMinor)}</td>
        <td>${badge(SERVICE_STATUS[x.status], x.status === 'completed' ? 'success' : x.status === 'scheduled' ? 'info' : 'neutral', x.status === 'completed' ? 'check' : 'clock')}</td>
        <td class="actions">${x.status !== 'completed' ? html`<button class="btn-link" data-action="service-next" data-id="${x.id}">Demo: mark ${x.status === 'to_schedule' ? 'scheduled' : 'completed'}</button>` : ''}</td></tr>`)}</tbody></table></div>` : ''}
    <section class="card"><div class="panel-title"><h2>Change plan</h2><button class="btn btn-ghost" data-action="plan-change">Request a plan change</button></div>
      <p class="small muted">Tier changes, bundle swaps and cancellations are handled as a request to VeriDex in this demo. Nothing changes automatically, and nothing is purchased without a payment step. New add-ons and setup services: <a href="${vm.persona.home}">buy them in the shop</a>.</p></section>
    <div class="table-wrap"><table><caption>Orders and receipts</caption><thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">What</th><th scope="col" class="num">Paid</th></tr></thead>
      <tbody>${orders.map((o) => html`<tr><th scope="row" class="mono">${o.id}</th><td>${date(o.createdAt)}</td><td>${o.kind === 'add_seats' ? 'Added: ' : ''}${o.lines.map((l) => l.skuName).join(', ')}${o.oneTimeMinor ? html`<br><span class="small muted">incl. ${money(o.oneTimeMinor)} one-time setup</span>` : ''}${o.note ? html`<br><span class="small muted">${o.note}</span>` : ''}</td><td class="num">${money(o.totalDueMinor)}<br><span class="small muted">${o.status}</span></td></tr>`)}</tbody></table></div></div>`;
}
const activity = (vm) => !vm.ws.activity.length ? html`<div class="empty"><h3>No activity yet</h3></div>` : html`<div class="table-wrap"><table><caption>Recent administration activity</caption><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Detail</th></tr></thead>
  <tbody>${vm.ws.activity.slice(0, 80).map((a) => html`<tr><td class="small" style="white-space:nowrap">${dateTime(a.at)}</td><th scope="row">${a.action}</th><td class="small">${a.detail}</td></tr>`)}</tbody></table></div>`;

export function tenantAdmin(vm) {
  const { ws, persona, tab } = vm, q = persona.id === 'carrier' ? '?p=carrier' : '';
  return html`<div class="page-head"><div><span class="eyebrow">${icon('user')} Tenant Admin · ${persona.short}</span><h1>${ws.onboarding.org.workspaceName || 'Your workspace'}</h1><p>Customer-side administration: your seats, your people, your billing. You cannot see or change VeriDex’s catalog here.</p></div>
    <div class="segmented" role="group" aria-label="Demo workspace"><a class="btn btn-sm ${persona.id === 'tenant' ? 'btn-primary' : 'btn-ghost'}" style="border-radius:0;border:0" href="tenant-admin.html">Tenant demo</a><a class="btn btn-sm ${persona.id === 'carrier' ? 'btn-primary' : 'btn-ghost'}" style="border-radius:0;border:0" href="tenant-admin.html?p=carrier">Carrier demo</a></div></div>
  ${!ws.subscriptions.length ? empty(persona) : html`<div class="admin"><nav class="side" aria-label="Tenant Admin sections">${TABS.map(([k, l, ic]) => html`<a href="#${k}" ${tab === k ? html`aria-current="page"` : ''}>${icon(ic)} ${l}</a>`)}<h4>Shortcuts</h4><a href="onboarding.html${q}">${icon('arrow')} Onboarding</a></nav>
    <div>${{ overview, people, invitations: invites, billing, activity }[tab](vm)}</div></div>`}`;
}
