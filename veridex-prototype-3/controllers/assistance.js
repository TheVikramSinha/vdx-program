// Guided assistance intake controller. Keeps its own draft; never mutates the cart.
import { personaFromPage, loadState, mount, toast } from './base.js';
import { intake } from '../views/templates/assistance.js';
import { personaOf } from '../data/personas.js';
import { validateLead, createLead, leadBrief } from '../models/leads.js';
import { offersFor } from '../models/catalog.js';
import { crm, download } from '../services/crmMock.js';
import { initChat } from './chat.js';

const pid = personaFromPage(), persona = personaOf(pid), S = loadState(pid);
const local = { errors: {}, stage: 'form', lead: null };
const d = () => S.draft.intake;
const cat = S.platform.catalog.published;
const interests = [...cat.products.filter((p) => p.status === 'active' && p.personas.includes(pid)).map((p) => p.name), ...offersFor(cat, pid, 'bundle').map((s) => `${s.name} bundle`)];
const input = () => ({ ...d(), followUp: d().followUp || 'email', source: 'intake', persona: pid, goals: [d().goal, d().goals].filter(Boolean).join(' — ') });
const commit = () => { S.save(); app.refresh(); };
const app = mount({ page: 'assistance', persona: pid, view: () => intake({ persona, d: d(), interests, ...local }), handlers: {
  f: (el) => { d()[el.id] = el.value; S.save(); },
  consent: (el) => { d().consent = el.checked; S.save(); },
  interest: (el) => { const s = new Set(d().interests || []); el.checked ? s.add(el.value) : s.delete(el.value); d().interests = [...s]; S.save(); },
  review: () => { local.errors = validateLead(input()); if (Object.keys(local.errors).length) { commit(); document.getElementById('error-summary')?.focus(); return; } local.stage = 'review'; commit(); window.scrollTo(0, 0); },
  edit: () => { local.stage = 'form'; commit(); },
  submit: async () => { const cartBefore = JSON.stringify(S.draft.cart); local.lead = createLead(S.platform, input()); await crm.submit(local.lead); if (JSON.stringify(S.draft.cart) !== cartBefore) throw new Error('Cart changed unexpectedly.'); S.draft.intake = {}; local.stage = 'done'; commit(); },
  brief: () => download(`veridex-lead-${local.lead.id}.txt`, leadBrief(local.lead)),
  again: () => { local.stage = 'form'; local.lead = null; commit(); },
  clear: () => { S.draft.intake = {}; local.errors = {}; commit(); toast('Form cleared.'); },
} });
initChat(S, () => ({ persona: persona.short, step: 'Expert guidance intake', products: d().interests || [] }));
