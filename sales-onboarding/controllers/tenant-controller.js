import { LABELS } from '../models/catalog.js?v=3.1';
import { esc, money } from '../views/helpers.js?v=3.1';
import { dialog, closeDialog, toast, downloadJSON } from '../services/ui.js?v=3.1';
export class TenantController {
  constructor(model,view,mode='sales'){this.model=model;this.view=view;this.mode=mode;this.ui={mode:model.state.bundle?'bundles':'custom'};}
  start(){
    document.addEventListener('click',e=>this.onClick(e));document.addEventListener('input',e=>this.onInput(e));document.addEventListener('change',e=>this.onChange(e));document.addEventListener('submit',e=>this.onSubmit(e));
    window.addEventListener('hashchange',()=>this.navigate(location.hash.slice(1)));
    this.navigate(location.hash.slice(1)||this.model.state[this.mode==='sales'?'salesRoute':'setupRoute'],false);
  }
  navigate(requested,focus=true){this.route=this.mode==='sales'?this.model.allowedSalesRoute(requested):this.model.allowedOnboardingRoute(requested);this.model.setRoute(this.route,this.mode);history.replaceState(null,'',`#${this.route}`);this.paint(focus);}
  paint(focus=false){this.view.render(this.model,this.route,this.ui);if(focus){scrollTo(0,0);document.querySelector('h1')?.focus({preventScroll:true});}}
  attempt(fn){try{fn();}catch(error){this.view.errors(error.message.split('\n'));}}
  onInput(e){const el=e.target,d=el.dataset;this.attempt(()=>{
    if(d.seats){try{this.model.setSeats(d.seats,el.value===''?0:el.value);el.setCustomValidity('');const panel=document.querySelector('[data-slot="summary"]');if(panel)panel.innerHTML=this.view.summary(this.model);}catch(error){el.setCustomValidity(error.message);el.reportValidity();}}
    if(d.userField){this.model.updateUser(d.module,d.user,{[d.userField]:el.value});this.view.refreshTeam(this.model);}
    if(el.form?.id==='checkout-form'&&el.name==='email')this.model.updatePayer({email:el.value});
    if(el.form?.id==='workspace-form'){
      const f=el.form;if(el.name==='name'&&!f.elements.slug.dataset.edited)f.elements.slug.value=el.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);if(el.name==='slug')f.elements.slug.dataset.edited='true';
      this.model.updateWorkspaceDraft({name:f.elements.name.value,slug:f.elements.slug.value,ownerName:f.elements.ownerName.value});this.view.refreshHints(this.model,this.route);
    }
  });}
  onChange(e){const el=e.target,d=el.dataset;this.attempt(()=>{
    if(d.tier){this.model.selectModule(d.tier,el.value);this.paint();}
    if(d.salesCheck){this.model.setSalesCheck(d.salesCheck,el.checked);this.view.updateGates(this.model,this.route);this.updateHintCount();}
    if(d.check){this.model.setCheck(d.check,el.checked);this.view.updateGates(this.model,this.route);this.updateHintCount();}
    if(el.id==='invite-now'){this.model.state.inviteNow=el.checked;this.model.save();}
    if(d.reuse&&el.value){const p=this.model.people().find(p=>p.email===el.value);this.model.addUser(d.reuse,{email:p.email,name:p.name});this.paint();}
    if(el.form?.id==='configuration-form'){this.model.updateConfigDraft({[el.name]:el.value});this.view.refreshHints(this.model,this.route);}
  });}
  updateHintCount(){const box=document.querySelector('.hint-box'),badge=box?.querySelector('.pill');if(badge){const required=[...box.querySelectorAll('.hint-item')].filter(el=>el.querySelector('small')?.textContent==='Required');badge.textContent=`${required.filter(el=>el.querySelector('input').checked).length}/${required.length} required`;}}
  onClick(e){const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;this.attempt(()=>{
    if(d.route)this.navigate(d.route);
    if(d.mode){this.ui.mode=d.mode;this.paint();}
    if(d.toggle){this.model.state.modules[d.toggle]?this.model.removeModule(d.toggle):this.model.selectModule(d.toggle);this.paint();}
    if(d.bundle){this.model.applyBundle(d.bundle);this.paint();toast('Bundle selected. Enter seat counts for its modules.');}
    if(d.billing){this.model.setBilling(d.billing);this.paint();}
    if(d.compare)dialog(`${LABELS[d.compare]} · compare tiers`,this.view.comparison(d.compare,this.model.state.billing));
    if(d.pick){const[k,t]=d.pick.split(':');this.model.selectModule(k,t);closeDialog();this.paint();}
    if(d.addUser){this.model.addUser(d.addUser);this.paint();const inputs=document.querySelectorAll(`[data-module="${d.addUser}"][data-user-field="email"]`);inputs[inputs.length-1]?.focus();}
    if(d.removeUser){this.model.removeUser(d.module,d.removeUser);this.paint();}
    if(d.profile){this.model.setProfile(d.profile);this.paint();}
    if(d.action==='apply-bundle-seats'){const input=document.getElementById('bundle-seats');if(!input.reportValidity())return;this.model.setBundleSeats(input.value);this.paint();}
    if(d.action==='review-order'){for(const input of document.querySelectorAll('[data-seats]'))if(!input.reportValidity())return;const errors=this.model.salesErrors();if(errors.length)this.view.errors(errors);else this.navigate('checkout');}
    if(d.action==='review-team'){this.model.reviewTeam();this.navigate('invitations');}
    if(d.action==='review-invitations'){this.model.reviewInvitations(this.model.state.inviteNow);this.navigate('configuration');}
    if(d.action==='reset')dialog('Start a fresh preview?',`<p>This clears the ${this.model.persona} purchase and setup in this tab. Other personas remain separate.</p><div class="form-actions"><button class="btn secondary" data-action="close">Keep progress</button><button class="btn" data-action="confirm-reset">Start fresh</button></div>`);
    if(d.action==='confirm-reset'){closeDialog();this.model.reset();location.href=this.view.link(this.model,'sales');}
    if(d.action==='about')dialog('Two distinct experiences','<p>Sales collects product choices, license quantities, and a purchaser receipt email. Onboarding unlocks after payment and collects workspace, owner, user, role, and readiness details.</p><p class="spaced">Each persona has isolated tab storage. Payments, emails, identity, and provisioning are simulated. Production requires server-side payment verification and tenant authorization.</p>');
    if(d.action==='download-order')downloadJSON('veridex-purchase.json',this.model.state.payment);
    if(d.action==='download')downloadJSON('veridex-onboarding.json',this.model.state);
    if(d.action==='workspace-preview')dialog(`${this.model.state.workspace.name} · overview`,`<div class="notice">Configured workspace preview · ${this.model.remaining()} licenses available for later</div><div class="table-scroll spaced">${this.view.roster(this.model,true)}</div><p class="small muted spaced">No live workspace or user accounts were created.</p>`);
  });}
  onSubmit(e){const f=e.target;if(!['checkout-form','workspace-form','configuration-form'].includes(f.id))return;e.preventDefault();const v=Object.fromEntries(new FormData(f));this.attempt(()=>{
    if(f.id==='checkout-form'){if(this.model.recordPayment({...v,accepted:v.accepted==='on'}))this.navigate('receipt');else this.view.errors([this.model.state.payment.status==='failed'?'Payment preview declined. No charge occurred. Onboarding remains locked; choose Successful payment to retry.':'Purchase cancelled. Your seat counts are saved, and onboarding remains locked.']);}
    if(f.id==='workspace-form'){this.model.saveWorkspace(v);this.navigate('team');}
    if(f.id==='configuration-form'){this.model.finish(v);this.navigate('success');}
  });}
}
