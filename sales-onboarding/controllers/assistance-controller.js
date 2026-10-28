import { dialog, closeDialog, downloadJSON } from '../services/ui.js?v=3.1';
export class AssistanceController {
  constructor(model,view){this.model=model;this.view=view;}
  start(){this.view.assistance(this.model,!!this.model.state.request);
    document.addEventListener('input',()=>this.capture());document.addEventListener('change',()=>this.capture());
    document.addEventListener('submit',e=>{if(e.target.id!=='assistance-form')return;e.preventDefault();try{this.model.submit(this.formData());this.view.assistance(this.model,true);this.view.focus();}catch(error){this.view.errors(error.message);}});
    document.addEventListener('click',e=>{const action=e.target.closest('button')?.dataset.action;if(action==='reset')dialog('Start a new guidance brief?','<p>This clears only the guidance request saved in this browser tab. Your tenant order and carrier discovery remain unchanged.</p><div class="form-actions"><button class="btn secondary" data-action="close">Keep request</button><button class="btn" data-action="confirm-reset">Start fresh</button></div>');if(action==='confirm-reset'){closeDialog();this.model.reset();this.view.assistance(this.model,false);this.view.focus();}if(action==='edit'){this.view.assistance(this.model,false);this.view.focus();}if(action==='download')downloadJSON('veridex-guidance-request.json',this.model.state.request);if(action==='privacy')dialog('About your information','<p>Your assistance preferences are saved only in this browser tab. No request is sent to a CRM or team inbox. Workspace naming and payment are not part of this form.</p><p class="spaced">This draft is separate from your self-service order and carrier onboarding.</p>');});
  }
  formData(){const f=document.getElementById('assistance-form'),data=new FormData(f);return {...Object.fromEntries(data),modules:data.getAll('modules'),consent:data.has('consent')};}
  capture(){if(document.getElementById('assistance-form'))this.model.saveDraft(this.formData());}
}
