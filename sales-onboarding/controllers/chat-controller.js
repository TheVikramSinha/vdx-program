import {ChatModel} from '../models/chat-model.js?v=4.2.1';
import {chatView} from '../views/chat-view.js?v=4.2.1';
import {SessionStore} from '../services/session-store.js?v=4.2.1';
import {downloadJSON} from '../services/ui.js?v=4.2.1';
export function mountChat({persona='tenant',context=()=>({experience:'assistance',step:'intake',modules:[]})}={}){
 const model=new ChatModel(new SessionStore(`vdx:chat:${persona}:v1`),persona);
 const launcher=document.createElement('button');launcher.className='chat-launcher';launcher.textContent='Chat with us';launcher.setAttribute('aria-haspopup','dialog');
 const panel=document.createElement('dialog');panel.className='chat-panel';panel.setAttribute('aria-labelledby','chat-title');document.body.append(launcher,panel);
 const render=()=>{const form=panel.querySelector('#chat-lead-form');if(form){const d=Object.fromEntries(new FormData(form));model.state.leadDraft={...d,consent:d.consent==='on'};model.save();}panel.innerHTML=chatView(model);if(panel.open)panel.querySelector('[data-chat="close"]').focus({preventScroll:true});};render();
 launcher.addEventListener('click',()=>{render();panel.showModal();panel.querySelector('[data-chat="close"]').focus();});
 panel.addEventListener('close',()=>launcher.focus());
 const attempt=fn=>{try{fn();}catch(e){panel.querySelector('.chat-error').textContent=e.message;}};
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;attempt(()=>{if(b.dataset.chatTopic){model.ask(b.dataset.chatTopic);render();}const action=b.dataset.chat;if(action==='close')panel.close();if(action==='handoff'){model.handoff();render();}if(action==='download')downloadJSON('veridex-chat-lead.json',model.state.lead);if(action==='edit-lead'){model.state.lead=null;model.save();render();}if(action==='reset'){panel.innerHTML='';model.reset();render();}});});
 panel.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const v=Object.fromEntries(new FormData(e.target));attempt(()=>{if(e.target.id==='chat-message-form')model.send(v.message);if(e.target.id==='chat-lead-form')model.prepareLead({...v,consent:v.consent==='on'},context());render();});});
}
