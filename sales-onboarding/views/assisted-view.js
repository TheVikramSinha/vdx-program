import { brand, esc, icon, field, options } from './helpers.js?v=3.1';
import { MODULES, LABELS } from '../models/catalog.js?v=3.1';
import { BUSINESS_TYPES, TEAM_SIZES } from '../models/assistance-model.js?v=3.1';
const choices=values=>Object.fromEntries(values.map(v=>[v,v]));
const select=(name,label,values,current)=>`<label class="field">${label}<select name="${name}" required>${options(choices(values),current)}</select></label>`;
const checks=(name,values,selected)=>values.map(v=>`<label class="check-label"><input type="checkbox" name="${name}" value="${esc(v)}" ${selected.includes(v)?'checked':''}><span>${esc(LABELS[v]||v)}</span></label>`).join('');
const row=(label,value)=>`<div class="review-row"><span>${label}</span><span>${esc(value)}</span></div>`;
export class AssistedView {
  constructor(root,templates){this.root=root;this.t=templates;}
  shell(body,carrier=false){this.root.innerHTML=this.t.render('assisted-shell',{brand:brand(),nav:carrier?'<span class="pill">Carrier pathway</span><a href="./index.html">Tenant self-service ↗</a>':'<a href="./index.html">Return to my setup</a><a href="./carrier.html">Carrier onboarding ↗</a>',body});}
  assistance(model,success=false){const d=model.state.draft,r=model.state.request;this.shell(success?this.t.render('assistance-success',{check:icon('check'),summary:row('Reference',r.reference)+row('Contact',r.email)+row('Team',`${r.type} · ${r.size} people`)+row('Product interests',r.modules.length?r.modules.map(k=>LABELS[k]).join(', '):'Expert recommendation requested')+row('Timing',r.timeline)+row('Contact preference',r.contact)+(r.goals?row('Priorities',r.goals):'')}):this.t.render('assistance-form',{fields:field('email','Work email',d.email,{type:'email',extra:'autocomplete="email" maxlength="254"'})+select('type','Organization type',BUSINESS_TYPES,d.type)+select('size','Indicative team size',TEAM_SIZES,d.size)+select('timeline','When are you looking to start?',['Exploring options','Within 30 days','1–3 months','3+ months'],d.timeline)+select('contact','How would you like to connect?',['Email','Schedule a call by email'],d.contact),modules:checks('modules',MODULES,d.modules),goals:esc(d.goals)}));document.title=`VeriDex — ${success?'Guidance request prepared':'Expert setup guidance'}`;}
  errors(message){const el=document.getElementById('page-errors');el.textContent=message;el.focus();el.scrollIntoView({block:'center'});}
  focus(){window.scrollTo(0,0);document.querySelector('h1')?.focus({preventScroll:true});}
}
