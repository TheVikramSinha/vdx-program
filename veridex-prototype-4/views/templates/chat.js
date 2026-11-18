// Chat widget view. Clearly labelled as a demo; context is limited to journey, step and selected product names.
import { html } from './html.js';
import { icon, field } from './components.js';
import { TOPICS } from '../../services/chatMock.js';
import { FOLLOW_UPS } from '../../models/leads.js';
const WHO = { user: 'You', bot: 'Assistant (simulated)', agent: 'Specialist (simulated demo)', system: 'System' };
export function chatView({ chat, ctx, form }) {
  if (!chat.open) return html`<button class="btn chat-fab" data-action="chat-open" id="chat-fab" aria-haspopup="dialog">${icon('chat')} Chat with us</button>`;
  return html`<section class="chat" role="dialog" aria-label="VeriDex demo chat" id="chat-panel">
    <header><h2>${icon('chat')} VeriDex chat <span class="small" style="font-weight:400">· demo</span></h2><button class="x" data-action="chat-close" aria-label="Close chat">${icon('x')}</button></header>
    <div class="ctx">Shared with chat: ${ctx.persona} journey · step “${ctx.step}” · products: ${ctx.products.length ? ctx.products.join(', ') : 'none selected'}. Nothing else is copied.</div>
    <div class="log" id="chat-log" role="log" aria-live="polite" tabindex="0" aria-label="Messages">
      ${!chat.messages.length ? html`<div class="msg"><small>${WHO.bot}</small>Hi. I am a scripted demo assistant, not a live service. Pick a topic or type a question.</div>` : ''}
      ${chat.messages.map((m) => html`<div class="msg ${m.from}"><small>${WHO[m.from]}</small>${m.text}</div>`)}
      ${form ? html`<form class="card tight stack-sm" data-submit="chat-lead" novalidate><b>Leave a follow-up request</b>
        ${field({ id: 'chat-email', label: 'Reply email', type: 'email', value: form.email || '', error: form.errors?.email, attrs: 'autocomplete="email"' })}
        ${field({ id: 'chat-follow', label: 'Preferred follow-up', value: form.followUp || 'email', options: Object.entries(FOLLOW_UPS), error: form.errors?.followUp })}
        <label class="check"><input type="checkbox" id="chat-consent" name="chat-consent" ${form.consent ? html`checked` : ''}><span>VeriDex may contact me about this request.${form.errors?.consent ? html`<br><span class="error" style="color:var(--rust);font-weight:600">${form.errors.consent}</span>` : ''}</span></label>
        <div class="row"><button class="btn btn-primary btn-sm" type="submit">Record request</button><button class="btn btn-ghost btn-sm" type="button" data-action="chat-lead-cancel">Cancel</button></div>
        <span class="small muted">This records a request in the demo. It does not book a meeting or send a message.</span></form>` : ''}
    </div>
    <footer><div class="chips">${TOPICS.map((t) => html`<button class="chip" data-action="chat-topic" data-id="${t.id}">${t.label}</button>`)}</div>
      <form data-submit="chat-send"><label class="sr-only" for="chat-input">Message</label><input type="text" id="chat-input" name="chat-input" maxlength="400" placeholder="Type a message" autocomplete="off"><button class="btn btn-primary btn-sm" type="submit">Send</button></form>
      <div class="tools"><label for="chat-avail">Demo: specialists</label><select id="chat-avail" data-change="chat-avail"><option value="online" ${chat.specialist === 'online' ? html`selected` : ''}>Online</option><option value="offline" ${chat.specialist === 'offline' ? html`selected` : ''}>Offline</option></select>
        <button class="btn-link" data-action="chat-download">Download transcript</button><button class="btn-link" data-action="chat-clear">Clear chat</button></div></footer></section>`;
}
