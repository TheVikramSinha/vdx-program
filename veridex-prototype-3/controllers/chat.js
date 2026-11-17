// Chat controller: persistent, accessible entry point. Simulated assistant, simulated specialist handoff, offline follow-up.
import { render } from '../views/templates/html.js';
import { chatView } from '../views/templates/chat.js';
import { toast } from '../views/templates/components.js';
import { reply, answerFor, TOPICS } from '../services/chatMock.js';
import { createLead, validateLead, leadBrief } from '../models/leads.js';
import { crm, download } from '../services/crmMock.js';

export function initChat(S, getContext) {
  const root = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'chat-root' }));
  let form = null;
  S.draft.chat.open = false; // messages persist across pages; the panel itself starts closed
  const chat = () => S.draft.chat;
  const say = (from, text) => { chat().messages.push({ from, text, at: new Date().toISOString() }); if (chat().messages.length > 100) chat().messages.shift(); };
  const paint = (focus) => {
    S.save(); render(root, chatView({ chat: chat(), ctx: getContext(), form }));
    const log = root.querySelector('#chat-log'); if (log) log.scrollTop = log.scrollHeight;
    if (focus) root.querySelector(focus)?.focus();
  };
  const handoff = () => {
    if (chat().specialist === 'online') { say('system', 'Connecting you to a specialist (simulated)…'); say('agent', 'Hello, this is a simulated specialist for the demo. In production a person would answer here. I can take a follow-up request if you would like a demo or setup call.'); form = { followUp: 'demo' }; }
    else { say('system', 'Specialists are offline right now (simulated). Typical hours would be shown here. You can leave a follow-up request instead.'); form = { followUp: 'email' }; }
  };
  const actions = {
    'chat-open': () => { chat().open = true; paint('#chat-input'); },
    'chat-close': () => { chat().open = false; form = null; paint('#chat-fab'); },
    'chat-topic': (el) => { const t = TOPICS.find((x) => x.id === el.dataset.id); say('user', t.label); if (t.id === 'human') handoff(); else say('bot', answerFor(t.id)); paint('#chat-input'); },
    'chat-clear': () => { chat().messages = []; form = null; paint('#chat-input'); },
    'chat-lead-cancel': () => { form = null; paint('#chat-input'); },
    'chat-download': () => {
      const c = getContext();
      download('veridex-chat-transcript.txt', [`VeriDex demo chat transcript`, `Journey: ${c.persona} · step: ${c.step} · products: ${c.products.join(', ') || 'none'}`, 'Simulated conversation. No message was delivered to VeriDex.', '', ...chat().messages.map((m) => `[${m.at}] ${m.from}: ${m.text}`)].join('\n'));
    },
  };
  root.addEventListener('click', (e) => { const el = e.target.closest('[data-action]'); if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](el); } });
  root.addEventListener('change', (e) => { if (e.target.id === 'chat-avail') { chat().specialist = e.target.value; say('system', `Demo setting: specialists are now ${e.target.value}.`); paint('#chat-avail'); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat().open) actions['chat-close'](); });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (e.target.dataset.submit === 'chat-send') {
      const text = String(fd.get('chat-input') || '').trim(); if (!text) return;
      say('user', text); const r = reply(text); if (r.handoff) handoff(); else say('bot', r.text); paint('#chat-input');
    } else {
      const c = getContext();
      const input = { email: String(fd.get('chat-email') || ''), followUp: fd.get('chat-follow'), consent: fd.get('chat-consent') === 'on', source: chat().specialist === 'online' ? 'chat' : 'chat-offline', persona: S.persona,
        interests: c.products, context: `Chat at step “${c.step}”` };
      const errors = validateLead(input);
      if (Object.keys(errors).length) { form = { ...input, errors }; paint(errors.email ? '#chat-email' : '#chat-consent'); return; }
      const lead = createLead(S.platform, input); await crm.submit(lead);
      form = null; say('system', `Request ${lead.id} recorded in this demo. This is a request only: no meeting is booked and no message was sent.`);
      paint('#chat-input'); toast('Follow-up request recorded (demo).');
      download(`veridex-lead-${lead.id}.txt`, leadBrief(lead));
    }
  });
  paint();
  return { open: () => actions['chat-open'](), repaint: () => paint() };
}
