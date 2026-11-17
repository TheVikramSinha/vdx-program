// Staff lead inbox controller (simulated; platform scope).
import { loadState, mount, toast, openDialog } from './base.js';
import { inbox, leadDetail } from '../views/templates/assistance.js';
import { updateLead } from '../models/leads.js';
const S = loadState('tenant');
const local = { filter: 'all' };
const app = mount({ page: 'leads', persona: 'tenant', view: () => inbox({ leads: S.platform.leads, ...local }), handlers: {
  filter: (el) => { local.filter = el.value; app.refresh(); },
  open: async (el) => {
    const l = S.platform.leads.find((x) => x.id === el.dataset.id);
    const ok = await openDialog({ title: `Lead ${l.id}`, body: leadDetail(l), actions: [{ label: 'Close', value: null }, { label: 'Save', submit: true, kind: 'primary' }],
      onSubmit: (fd) => { updateLead(S.platform, l.id, { status: fd.get('ld-status'), owner: fd.get('ld-owner'), note: fd.get('ld-note') }); } });
    S.save(); app.refresh(); if (ok) toast('Lead updated.');
  },
} });
window.addEventListener('storage', () => { S.reload(); app.refresh(); });
