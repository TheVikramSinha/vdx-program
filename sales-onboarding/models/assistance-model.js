import { MODULES } from './catalog.js?v=3.1';
import { validEmail, emailKey } from './validation.js?v=3.1';
export const TEAM_SIZES=['1–10','11–50','51–200','201+','Not sure yet'];
export const BUSINESS_TYPES=['MGA / MGU','Broker / Agency','Legal practice','Other'];
export class AssistanceModel {
  constructor(store,selected=[]){this.store=store;const saved=store?.load();this.state=saved?.flow==='assistance'&&saved.version===2?saved:{flow:'assistance',version:2,draft:{email:'',type:'MGA / MGU',size:'1–10',timeline:'Exploring options',contact:'Email',goals:'',modules:selected.filter(k=>MODULES.includes(k))},request:null};}
  reset(){ this.state=new AssistanceModel(undefined).state; this.store?.clear(); this.store?.save(this.state); }
  saveDraft(data){this.state.draft={...this.state.draft,...data};this.store?.save(this.state);}
  submit(data){
    if(!validEmail(data.email))throw new Error('Enter a valid contact email.');
    if(!BUSINESS_TYPES.includes(data.type))throw new Error('Choose a supported organization type. Carriers use the dedicated carrier flow.');
    if(!TEAM_SIZES.includes(data.size)||!['Exploring options','Within 30 days','1–3 months','3+ months'].includes(data.timeline)||!['Email','Schedule a call by email'].includes(data.contact))throw new Error('Choose valid team and planning preferences.');
    if(!Array.isArray(data.modules)||data.modules.some(k=>!MODULES.includes(k)))throw new Error('Select valid product interests.');
    if(!data.consent)throw new Error('Confirm that an expert may contact you about setup.');
    this.state.draft={email:emailKey(data.email),type:data.type,size:data.size,timeline:data.timeline,contact:data.contact,modules:data.modules,consent:!!data.consent,goals:String(data.goals||'').slice(0,1500)};
    this.state.request={reference:`HELP-${crypto.randomUUID().slice(0,8).toUpperCase()}`,preparedAt:new Date().toISOString(),status:'Prepared locally',...structuredClone(this.state.draft)};
    this.store?.save(this.state);return this.state.request;
  }
}
