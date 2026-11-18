// Staff inbox controller (simulated; platform scope): leads/requests and abandoned carts.
import { loadState, mount, toast, openDialog, html } from './base.js';
import { inbox, leadDetail, cartDetail } from '../views/templates/assistance.js';
import { updateLead } from '../models/leads.js';
import { sessionStatus, updateFollowUp, cartBrief } from '../models/cartSessions.js';
import { fmt } from '../models/money.js';
import { download } from '../services/crmMock.js';
const S = loadState('tenant');
const local = { filter: 'all', cartFilter: 'abandoned' };
const tab = () => (location.hash === '#leads' ? 'leads' : 'carts');
const after = () => S.platform.cartSettings?.abandonAfterMinutes ?? 60;
const carts = () => (S.platform.cartSessions || []).map((c) => ({ ...c, status: sessionStatus(c, after()) }));
const app = mount({ page: 'leads', persona: 'tenant', view: () => inbox({ leads: S.platform.leads, carts: carts(), abandonAfter: after(), tab: tab(), ...local }), handlers: {
  filter: (el) => { local.filter = el.value; app.refresh(); },
  'cart-filter': (el) => { local.cartFilter = el.value; app.refresh(); },
  'abandon-after': (el) => { S.platform.cartSettings = { ...(S.platform.cartSettings || {}), abandonAfterMinutes: Number(el.value) }; S.save(); app.refresh(); },
  open: async (el) => {
    const l = S.platform.leads.find((x) => x.id === el.dataset.id);
    const ok = await openDialog({ title: `Lead ${l.id}`, body: leadDetail(l), actions: [{ label: 'Close', value: null }, { label: 'Save', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { updateLead(S.platform, l.id, { status: fd.get('ld-status'), owner: fd.get('ld-owner'), note: fd.get('ld-note') }); } });
    S.save(); app.refresh(); if (ok) toast('Lead updated.');
  },
  'open-cart': async (el) => {
    const c = S.platform.cartSessions.find((x) => x.id === el.dataset.id), st = sessionStatus(c, after());
    const r = await openDialog({ title: `Cart ${c.id} · ${c.contact.name}`, wide: true, body: cartDetail(c, st),
      actions: [{ label: 'Close', value: null }, { label: 'Download follow-up brief', value: 'brief', kind: 'ghost' }, { label: 'Save', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { updateFollowUp(S.platform, c.id, { status: fd.get('cd-status'), owner: fd.get('cd-owner'), note: fd.get('cd-note') }); } });
    if (r === 'brief') download(`veridex-cart-${c.id}.txt`, cartBrief(c, st, fmt));
    S.save(); app.refresh(); if (r === true) toast('Cart follow-up updated.');
  },
} });
window.addEventListener('hashchange', () => app.refresh());
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
