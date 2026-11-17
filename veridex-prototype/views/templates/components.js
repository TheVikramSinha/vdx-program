// Shared presentational components (pure template functions) plus dialog/toast helpers.
import { html, esc } from './html.js';
import { fmt } from '../../models/money.js';

export const icon = (name, cls = '') => html`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="assets/icons/sprite.svg#i-${name}"></use></svg>`;
export const money = (minor, cur) => fmt(minor, cur);
export const date = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
export const dateTime = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const badge = (text, kind = 'neutral', ic) => html`<span class="badge ${kind}">${ic ? icon(ic) : ''}${text}</span>`;
const ALERT_ICON = { info: 'info', success: 'check', warning: 'warn', danger: 'stop' };
const ALERT_WORD = { info: 'Note', success: 'Done', warning: 'Check', danger: 'Problem' };
export const alert = (kind, title, body = '') => html`<div class="alert ${kind}" role="${kind === 'danger' ? 'alert' : 'status'}">${icon(ALERT_ICON[kind])}<div><strong><span class="sr-only">${ALERT_WORD[kind]}: </span>${title}</strong>${body}</div></div>`;

export const MEMBER_BADGE = { draft: ['Not invited', 'outline', 'user'], invited: ['Invitation pending', 'info', 'mail'], active: ['Active', 'success', 'check'], expired: ['Invitation expired', 'warning', 'clock'], suspended: ['Suspended', 'neutral', 'pause'], revoked: ['Revoked', 'danger', 'stop'] };
export const memberBadge = (status) => badge(...MEMBER_BADGE[status]);

export function field({ id, label, value = '', type = 'text', error, hint, optional, attrs = '', options, placeholder }) {
  const described = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ');
  const common = html`id="${id}" name="${id}" ${error ? html`aria-invalid="true"` : ''} ${described ? html`aria-describedby="${described}"` : ''}`;
  const control = options
    ? html`<select ${common} ${htmlAttrs(attrs)}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value="${v}" ${String(v) === String(value) ? html`selected` : ''}>${l}</option>`; })}</select>`
    : type === 'textarea' ? html`<textarea ${common} ${htmlAttrs(attrs)}>${value}</textarea>`
    : html`<input type="${type}" ${common} value="${value}" ${placeholder ? html`placeholder="${placeholder}"` : ''} ${htmlAttrs(attrs)}>`;
  return html`<div class="field"><label for="${id}">${label}${optional ? html` <span class="opt">(optional)</span>` : ''}</label>${control}${hint ? html`<span class="hint" id="${id}-hint">${hint}</span>` : ''}${error ? html`<span class="error" id="${id}-err">${icon('stop')}${error}</span>` : ''}</div>`;
}
// attrs strings are authored in templates (never user input), so they are passed through.
const htmlAttrs = (attrs) => attrs ? html([attrs]) : '';

export function errorSummary(errors, title = 'Fix the following to continue') {
  const list = Object.entries(errors);
  if (!list.length) return '';
  return html`<div class="error-summary" role="alert" tabindex="-1" id="error-summary"><h3>${icon('stop')} ${title}</h3><ul>${list.map(([k, m]) => html`<li>${/^[\w-]+$/.test(k) && !/^\d+$/.test(k) ? html`<a href="#${k}">${m}</a>` : m}</li>`)}</ul></div>`;
}

export function checklistBox(items, { title = 'Before you continue', action = 'check-toggle' } = {}) {
  if (!items.length) return '';
  const reqLeft = items.filter((i) => i.required && !i.done).length;
  return html`<section class="checklist" aria-labelledby="cl-title">
    <header><h3 id="cl-title">${icon('info')} ${title}</h3>${reqLeft ? badge(`${reqLeft} required left`, 'warning', 'warn') : badge('Ready', 'success', 'check')}</header>
    <ul>${items.map((i) => html`<li class="${i.done ? 'done' : ''}">
      ${i.kind === 'confirm' ? html`<input type="checkbox" id="cl-${i.id}" data-change="${action}" data-id="${i.id}" ${i.done ? html`checked` : ''}>` : html`<span class="state" aria-hidden="true">${icon('check')}</span>`}
      <div>${i.kind === 'confirm' ? html`<label for="cl-${i.id}">${i.label}</label>` : html`<span>${i.label}<span class="sr-only"> — ${i.done ? 'complete' : 'not complete'}</span></span>`}
        <span class="hint"><span class="tag ${i.required ? 'req' : 'rec'}">${i.required ? 'Required' : 'Recommended'}</span>${i.kind === 'auto' ? html` · ${i.done ? 'Complete' : 'Not complete'} (checked automatically)` : ''}${i.stale ? html` · <strong>Cleared because related details changed — confirm again</strong>` : ''}${i.hint ? html` · ${i.hint}` : ''}</span></div></li>`)}</ul></section>`;
}

export function capacityCard(c, extra = '') {
  const pct = (n) => c.purchased ? (n / c.purchased) * 100 : 0;
  return html`<div class="card tight cap-card">
    <div class="row between"><h3 style="margin:0">${c.productName} <span class="muted small">${c.tierName}</span></h3>${c.available === 0 ? badge('Full', 'warning', 'warn') : badge(`${c.available} available`, 'success', 'check')}</div>
    <div class="meter" role="img" aria-label="${c.productName}: ${c.assigned} assigned, ${c.reserved} reserved, ${c.available} available of ${c.purchased} purchased"><i class="a" style="width:${pct(c.assigned)}%"></i><i class="r" style="width:${pct(c.reserved)}%"></i></div>
    <div class="cap-nums"><div><b>${c.purchased}</b><span>Purchased</span></div><div><b>${c.assigned}</b><span>Assigned</span></div><div><b>${c.reserved}</b><span>Reserved</span></div><div><b>${c.available}</b><span>Available</span></div></div>${extra}</div>`;
}
export const capacityLegend = () => html`<div class="legend" aria-hidden="true"><span><i class="a"></i>Assigned (active or suspended)</span><span><i class="r"></i>Reserved (invited or not yet invited)</span><span><i class="f"></i>Available</span></div>`;

/* ---------- Toasts ---------- */
let toastHost;
export function toast(message, kind = 'info') {
  toastHost ||= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toasts' }));
  toastHost.setAttribute('role', 'status'); toastHost.setAttribute('aria-live', 'polite');
  const t = document.createElement('div');
  t.className = `toast ${kind}`; t.textContent = (kind === 'error' ? 'Problem: ' : '') + message;
  toastHost.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 4000);
}

/* ---------- Dialogs (native <dialog>: focus trap, Esc, focus restored to the opener) ---------- */
export function openDialog({ title, body, actions = [{ label: 'Close', value: null, kind: 'ghost' }], wide = false, onSubmit, onMount }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const openerKey = opener?.id ? `#${CSS.escape(opener.id)}` : opener?.dataset?.action ? `[data-action="${opener.dataset.action}"]${opener.dataset.id ? `[data-id="${CSS.escape(opener.dataset.id)}"]` : ''}` : null;
    const d = document.createElement('dialog');
    if (wide) d.className = 'wide';
    const tid = `dlg-${Date.now()}`;
    d.setAttribute('aria-labelledby', tid);
    d.innerHTML = String(html`<form method="dialog" novalidate>
      <div class="dlg-head"><h2 id="${tid}">${title}</h2><button type="button" class="x" data-close aria-label="Close dialog">${icon('x')}</button></div>
      <div class="dlg-body"><div data-dlg-error></div>${body}</div>
      <div class="dlg-foot">${actions.map((a, i) => html`<button class="btn btn-${a.kind || 'ghost'}" ${a.submit ? html`type="submit"` : html`type="button" data-value="${i}"`}>${a.label}</button>`)}</div></form>`);
    document.body.append(d);
    let result = null;
    const done = (v) => { result = v; d.close(); };
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return done(null);
      const b = e.target.closest('[data-value]');
      if (b) done(actions[+b.dataset.value].value);
    });
    d.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const v = onSubmit ? await onSubmit(new FormData(e.target), d) : true; if (v !== false) done(v ?? true); }
      catch (err) {
        const box = d.querySelector('[data-dlg-error]');
        box.innerHTML = String(html`<div class="error-summary" role="alert" tabindex="-1"><h3>${icon('stop')} Could not continue</h3><ul><li>${err.message}</li></ul></div>`);
        box.firstElementChild.focus();
      }
    });
    d.addEventListener('close', () => {
      d.remove(); resolve(result);
      const back = (openerKey && document.querySelector(openerKey)) || (opener?.isConnected ? opener : document.querySelector('main'));
      back?.focus?.({ preventScroll: true });
    });
    d.showModal();
    onMount?.(d, done);
  });
}
export const confirmDialog = ({ title, body, confirmLabel = 'Confirm', kind = 'primary' }) =>
  openDialog({ title, body, actions: [{ label: 'Cancel', value: false, kind: 'ghost' }, { label: confirmLabel, value: true, kind }] });
export { esc };
