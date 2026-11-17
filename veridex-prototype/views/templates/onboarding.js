// Post-payment onboarding views.
import { html } from './html.js';
import { icon, badge, alert, field, errorSummary, checklistBox, capacityCard, capacityLegend, memberBadge, date, money } from './components.js';
import { REGIONS, SIGN_IN } from '../../models/onboarding.js';
import { ROLES, MEMBER_TYPES, seatsOf, liveMembers } from '../../models/licensing.js';

export function locked(persona) {
  return html`<section class="card locked">${icon('lock')}<h1>Onboarding unlocks after purchase</h1>
    <p class="muted">This ${persona.short.toLowerCase()} workspace has no completed purchase, so there is nothing to set up yet. Direct links cannot skip payment.</p>
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${persona.home}">Go to the ${persona.short.toLowerCase()} shop</a><button class="btn btn-ghost" data-action="demo-tools">Load a demo scenario</button></div></section>`;
}
export function stepper(states) {
  return html`<nav aria-label="Onboarding progress"><ol class="stepper">${states.map((s) => html`<li data-state="${s.state}"><button data-action="goto" data-id="${s.index}" ${s.state === 'current' ? html`aria-current="step"` : ''} ${s.state === 'blocked' ? html`aria-disabled="true"` : ''}>
    <span class="dot" aria-hidden="true">${s.state === 'complete' ? icon('check') : s.state === 'blocked' ? icon('lock') : s.index + 1}</span>
    <span class="lbl"><small>${{ complete: 'Complete', current: 'Current step', blocked: 'Locked', available: 'Open' }[s.state]}</small>${s.label}</span></button></li>`)}</ol></nav>`;
}
const capStrip = (cap) => html`<div class="grid g3">${cap.map((c) => capacityCard(c))}</div>${capacityLegend()}`;

function stepWorkspace(vm) {
  const o = vm.ws.onboarding.org, e = vm.errors, p = vm.persona;
  return html`<form class="stack" data-submit="save-org" novalidate>
    <section class="card"><h2>Organization</h2><div class="form-grid">
      ${field({ id: 'orgName', label: 'Sign-in organization', value: o.orgName, error: e.orgName, hint: 'The organization people sign in to.', attrs: 'data-change="org" autocomplete="organization"' })}
      ${field({ id: 'businessType', label: 'Business type', value: o.businessType, error: e.businessType, options: [['', 'Choose…'], ...p.businessTypes], attrs: 'data-change="org"' })}
      <div class="full">${field({ id: 'legalEntity', label: 'Legal entity name', value: o.legalEntity, optional: true, hint: 'Only if different from the organization name.', attrs: 'data-change="org"' })}</div>
      ${p.id === 'carrier' ? html`<fieldset class="full"><legend>Lines of business in scope</legend>${e.lines ? html`<span class="error" style="color:var(--rust);font-weight:600" id="lines">${e.lines}</span>` : ''}<div class="row">${p.lines.map((l) => html`<label class="check"><input type="checkbox" data-change="org-line" value="${l}" ${(o.lines || []).includes(l) ? html`checked` : ''}><span>${l}</span></label>`)}</div></fieldset>
        ${field({ id: 'carrierCode', label: 'Company code', value: o.carrierCode, optional: true, hint: 'For your own reference. Not verified in this demo.', attrs: 'data-change="org"' })}` : ''}</div></section>
    <section class="card"><h2>Workspace</h2><div class="form-grid">
      ${field({ id: 'workspaceName', label: 'Workspace name', value: o.workspaceName, error: e.workspaceName, attrs: 'data-change="org"' })}
      ${field({ id: 'workspaceSlug', label: 'Workspace address', value: o.workspaceSlug, error: e.workspaceSlug, hint: `${o.workspaceSlug || 'your-name'}.veridex.example — illustrative, nothing is provisioned.`, attrs: 'data-change="org" autocapitalize="none" spellcheck="false"' })}
      <div class="full">${field({ id: 'region', label: 'Preferred data region', value: o.region, error: e.region, options: [['', 'Choose…'], ...REGIONS], hint: 'A preference only. Hosting region would be confirmed in writing before provisioning.', attrs: 'data-change="org"' })}</div></div></section>
    <section class="card"><div class="panel-title"><h2>Workspace administrator</h2>${badge('Free · uses no seat', 'success', 'shield')}</div>
      <p class="small muted">Manages billing, invitations, people and seats. The role alone gives no access to any module; assign a seat in the next step if this person also uses one.${vm.prefilled ? ' Prefilled from the receipt contact — change it if someone else will administer.' : ''}</p>
      <div class="form-grid">${field({ id: 'adminName', label: 'Administrator name', value: o.adminName, error: e.adminName, attrs: 'data-change="org" autocomplete="name"' })}
        ${field({ id: 'adminEmail', label: 'Administrator email', type: 'email', value: o.adminEmail, error: e.adminEmail, attrs: 'data-change="org" autocomplete="email"' })}</div></section>
    <button type="submit" class="sr-only" tabindex="-1">Save</button></form>`;
}
function stepPeople(vm) {
  const { ws, cap } = vm;
  const people = liveMembers(ws);
  return html`<div class="stack">
    ${capStrip(cap)}
    <section class="card"><h2>Add a person</h2><p class="small muted">One membership per person. Someone who uses two modules holds one seat in each.</p>
      <form class="row" data-submit="add-person" novalidate style="align-items:flex-end">
        <div class="grow">${field({ id: 'p-name', label: 'Name', error: vm.personErrors.name, value: vm.personDraft.name, attrs: 'autocomplete="off"' })}</div>
        <div class="grow">${field({ id: 'p-email', label: 'Work email', type: 'email', error: vm.personErrors.email, value: vm.personDraft.email, attrs: 'autocomplete="off"' })}</div>
        <div>${field({ id: 'p-type', label: 'Membership type', options: Object.entries(MEMBER_TYPES), value: vm.personDraft.type })}</div>
        <button class="btn btn-primary" type="submit">Add person</button></form>
      <div class="row" style="margin-top:var(--s3)"><button class="btn btn-ghost btn-sm" data-action="import-sample">Import sample CSV</button><label class="btn btn-ghost btn-sm" for="csv-file">Upload CSV</label><input class="sr-only" type="file" id="csv-file" accept=".csv,text/csv" data-change="csv-file">
        <a class="small" href="data/sample-team.csv" download>Download CSV template</a></div></section>
    <div class="table-wrap"><table class="matrix"><caption>People and module access · ${people.length} ${people.length === 1 ? 'person' : 'people'}, ${ws.assignments.length} seats in use</caption>
      <thead><tr><th scope="col">Person</th>${cap.map((c) => html`<th scope="col">${c.productName}<br><span class="small" style="text-transform:none;letter-spacing:0">${c.available} of ${c.purchased} available</span></th>`)}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${people.map((m) => { const seats = seatsOf(ws, m.id); return html`<tr><th scope="row">${m.name} ${m.isAdmin ? badge('Admin · free', 'success', 'shield') : ''}<br><span class="small muted">${m.email} · ${MEMBER_TYPES[m.type]}</span></th>
        ${cap.map((c) => { const a = seats.find((s) => s.productId === c.productId); const full = !a && c.available < 1; return html`<td><div class="seat-cell"><input type="checkbox" id="seat-${m.id}-${c.productId}" data-change="seat" data-id="${m.id}" data-pid="${c.productId}" ${a ? html`checked` : ''} ${full ? html`disabled` : ''} aria-label="${c.productName} seat for ${m.name}${full ? ' — module full' : ''}">
          ${a ? html`<select data-change="role" data-id="${m.id}" data-pid="${c.productId}" aria-label="${c.productName} role for ${m.name}">${ROLES.map((r) => html`<option ${r === a.role ? html`selected` : ''}>${r}</option>`)}</select>` : full ? html`<span class="small muted">Full</span>` : html`<span class="small muted">No seat</span>`}</div></td>`; })}
        <td class="actions">${m.isAdmin ? html`<span class="small muted">Administrator</span>` : html`<button class="btn-link" data-action="remove-person" data-id="${m.id}">Remove<span class="sr-only"> ${m.name}</span></button>`}</td></tr>`; })}</tbody></table></div>
    ${people.length < 2 ? alert('info', 'Only the administrator so far.', html`<p class="small">That is fine — the administrator uses no seat. Add people now or later from Tenant Admin. Unassigned seats remain paid.</p>`) : ''}</div>`;
}
function stepInvites(vm) {
  const { ws } = vm;
  const people = liveMembers(ws).filter((m) => !(m.isAdmin && m.status === 'active' && !m.invite));
  const drafts = people.filter((m) => m.status === 'draft').length;
  return html`<div class="stack">
    ${alert('info', 'Invitations are simulated.', html`<p class="small">Nothing is emailed. A pending invitation reserves the person’s seats; accepting it turns those same reservations into assigned seats. Expired invitations keep the reservation until you resend or revoke.</p>`)}
    ${!people.length ? html`<div class="empty"><h3>No one to invite yet</h3><p>Add people in the previous step, or continue and invite later from Tenant Admin.</p></div>` : html`
    <div class="row"><button class="btn btn-primary" data-action="send-all" ${drafts ? '' : html`disabled`}>${icon('mail')} Send ${drafts || ''} invitation${drafts === 1 ? '' : 's'} (simulated)</button>
      <button class="btn btn-ghost" data-action="defer" ${drafts ? '' : html`disabled`}>Defer — I will invite later</button>${ws.onboarding.inviteDecision === 'deferred' ? badge('Deferred', 'neutral', 'clock') : ''}</div>
    <div class="table-wrap"><table><caption>Review each person’s combined access</caption><thead><tr><th scope="col">Person</th><th scope="col">Access in this invitation</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${people.map((m) => { const seats = seatsOf(ws, m.id); return html`<tr><th scope="row">${m.name}<br><span class="small muted">${m.email}</span></th>
        <td>${seats.length ? seats.map((s) => html`<div>${ws.entitlements[s.productId].productName} · ${s.role}</div>`) : html`<span class="muted">Workspace access only — no module seat</span>`}${m.isAdmin ? html`<div>${badge('Administrator', 'success', 'shield')}</div>` : ''}</td>
        <td>${memberBadge(m.status)}${m.invite && m.status !== 'active' ? html`<br><span class="small muted">${m.status === 'expired' ? 'Expired' : 'Expires'} ${date(m.invite.expiresAt)} · sent ${m.invite.count}×</span>` : ''}</td>
        <td class="actions">${m.status === 'draft' ? html`<button class="btn-link" data-action="invite" data-id="${m.id}">Send</button>` : ''}
          ${['invited', 'expired'].includes(m.status) ? html`<button class="btn-link" data-action="invite" data-id="${m.id}">Resend</button> <button class="btn-link" data-action="revoke" data-id="${m.id}">Revoke</button>` : ''}
          ${m.status === 'invited' ? html`<br><span class="small muted">Demo:</span> <button class="btn-link" data-action="sim-accept" data-id="${m.id}">Simulate accept</button> <button class="btn-link" data-action="sim-expire" data-id="${m.id}">Simulate expiry</button>` : ''}</td></tr>`; })}</tbody></table></div>`}</div>`;
}
function stepReadiness(vm) {
  const { ws, cap, persona } = vm, r = ws.onboarding.readiness;
  return html`<div class="stack">
    <section class="card"><fieldset><legend><h2 style="margin:0 0 var(--s2)">Sign-in preference</h2></legend><div class="stack-sm">${Object.entries(SIGN_IN).map(([k, l]) => html`<label class="choice"><input type="radio" name="signIn" value="${k}" data-change="ready" ${r.signIn === k ? html`checked` : ''}><span>${l}</span></label>`)}</div>
      <p class="small muted" style="margin-top:var(--s2)">A preference for setup. No identity provider is connected in this demo.</p></fieldset>
      <div style="max-width:320px;margin-top:var(--s4)">${field({ id: 'defaultRole', label: 'Default role for new seats', value: r.defaultRole, options: ROLES, attrs: 'data-change="ready"' })}</div></section>
    <section class="card"><h2>Module visibility and enablement</h2><p class="small muted">Hiding or disabling a module changes what people see. It never changes purchased seats or billing.</p>
      <div class="table-wrap"><table><thead><tr><th scope="col">Module</th><th scope="col">Enabled</th><th scope="col">Visible in navigation</th><th scope="col" class="num">Purchased seats</th></tr></thead>
        <tbody>${cap.map((c) => html`<tr><th scope="row">${c.productName} <span class="muted small">${c.tierName}</span></th>
          <td><label class="check"><input type="checkbox" data-change="flag" data-pid="${c.productId}" data-arg="enabled" ${c.enabled ? html`checked` : ''}><span>${c.enabled ? 'Enabled' : 'Disabled'}</span></label></td>
          <td><label class="check"><input type="checkbox" data-change="flag" data-pid="${c.productId}" data-arg="visible" ${c.visible ? html`checked` : ''}><span>${c.visible ? 'Visible' : 'Hidden'}</span></label></td><td class="num">${c.purchased} <span class="small muted">unchanged</span></td></tr>`)}</tbody></table></div></section>
    ${persona.id === 'carrier' ? html`<section class="card"><h2>Carrier rollout</h2>
      <fieldset><legend>Operating regions in the first rollout</legend><div class="row">${persona.regions.map((x) => html`<label class="check"><input type="checkbox" data-change="ready-region" value="${x}" ${r.regions.includes(x) ? html`checked` : ''}><span>${x}</span></label>`)}</div></fieldset>
      <fieldset style="margin-top:var(--s4)"><legend>Rollout approach</legend><div class="grid g2">${[['phased', 'Phased by region', 'Start with one region, expand after a review.'], ['all', 'All selected regions together', 'Single go-live date.']].map(([k, a, b]) => html`<label class="choice"><input type="radio" name="rollout" value="${k}" data-change="ready" ${r.rollout === k ? html`checked` : ''}><span><b>${a}</b><br><span class="small muted">${b}</span></span></label>`)}</div></fieldset></section>` : ''}</div>`;
}
function stepSuccess(vm) {
  const { ws, cap, totals, persona, orders } = vm, o = ws.onboarding, q = persona.id === 'carrier' ? '?p=carrier' : '';
  const pending = liveMembers(ws).filter((m) => ['draft', 'invited', 'expired'].includes(m.status));
  return html`<div class="stack">
    <section class="card" style="border-top:6px solid var(--teal)"><img class="receipt-logo" src="assets/brand/veridex-logo-primary.png" alt="VeriDex Solution.AI"><h1 style="margin-top:var(--s3)">${o.completedAt ? html`${icon('check')} Setup recorded` : 'Ready to finish'}</h1>
      <p class="muted">${o.completedAt ? 'Your choices are saved in this demo. No workspace was provisioned and no identity was verified.' : 'Review the summary, then finish setup.'}</p>
      <div class="row">${o.completedAt ? html`<a class="btn btn-primary" href="tenant-admin.html${q}">Open Tenant Admin ${icon('arrow')}</a>` : html`<button class="btn btn-primary" data-action="finish">Finish setup</button>`}</div></section>
    <div class="grid g4"><div class="card tight stat"><b>${totals.people}</b><span>People (distinct)</span></div><div class="card tight stat"><b>${totals.seatsUsed} / ${totals.seatsPurchased}</b><span>Module seats in use</span></div><div class="card tight stat"><b>${totals.admins}</b><span>Administrators (free)</span></div><div class="card tight stat"><b>${pending.length}</b><span>People not yet active</span></div></div>
    <div class="grid g2"><section class="card"><h2>Workspace</h2><dl class="kv"><dt>Organization</dt><dd>${o.org.orgName}</dd><dt>Workspace</dt><dd>${o.org.workspaceName} <span class="mono muted">${o.org.workspaceSlug}.veridex.example</span></dd><dt>Administrator</dt><dd>${o.org.adminName} · uses no seat</dd><dt>Data region</dt><dd>${o.org.region} (preference)</dd><dt>Sign-in</dt><dd>${SIGN_IN[o.readiness.signIn] || '—'}</dd>
      ${persona.id === 'carrier' ? html`<dt>Regions</dt><dd>${o.readiness.regions.join(', ') || '—'}</dd><dt>Rollout</dt><dd>${o.readiness.rollout || 'Not noted'}</dd>` : ''}</dl></section>
      <section class="card"><h2>Purchase</h2>${orders.map((x) => html`<p style="margin-bottom:6px"><b class="mono">${x.id}</b> · ${date(x.createdAt)} · ${money(x.totalDueMinor)}<br><span class="small muted">${x.lines.map((l) => `${l.skuName} (${l.skuId})`).join(', ')}</span></p>`)}</section></div>
    ${capStrip(cap)}
    ${pending.length || vm.skipped.length ? html`<section class="card"><h2>Pending work</h2><ul>${pending.map((m) => html`<li>${m.name}: ${{ draft: 'not invited yet', invited: 'invitation pending', expired: 'invitation expired — resend or revoke' }[m.status]}</li>`)}${vm.skipped.map((s) => html`<li>Skipped recommendation: ${s}</li>`)}</ul></section>` : ''}</div>`;
}
export function onboarding(vm) {
  const { ws, persona, states, step, checklist, gate } = vm;
  const body = [stepWorkspace, stepPeople, stepInvites, stepReadiness, stepSuccess][step](vm);
  return html`<div class="page-head"><div><span class="eyebrow">${persona.short} onboarding</span><h1>Set up your workspace</h1><p>Step ${step + 1} of 5 · ${states[step].label}. Progress saves as you go.</p></div>
    <span class="small muted">${icon('info')} Demo: nothing is provisioned</span></div>
  ${stepper(states)}
  ${step === 4 ? body : html`<div class="with-aside"><div class="stack">${vm.gateErrors ? errorSummary(vm.gateErrors, 'Complete the required items to continue') : ''}${body}
    <div class="row between"><button class="btn btn-ghost" data-action="back" ${step === 0 ? html`disabled` : ''}>Back</button><button class="btn btn-primary" data-action="next">${step === 3 ? 'Review and finish' : 'Save and continue'} ${icon('arrow')}</button></div></div>
    <aside>${checklistBox(checklist, { title: 'Checklist for this step' })}
      ${gate.skipped.length && gate.ok ? alert('info', 'You can continue.', html`<p class="small">Recommended items left open are listed as follow-up on the final step.</p>`) : ''}
      <section class="card tight flat"><h3>Need a hand?</h3><p class="small">Use the chat button, or request a setup call.</p><a class="small" href="assistance.html${persona.id === 'carrier' ? '?p=carrier' : ''}">Request guidance</a></section></aside></div>`}`;
}
