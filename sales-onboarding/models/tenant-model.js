import { initialIdentity, identityExport, TENANT_TYPES, MEMBERSHIP_TYPES, DATA_REGIONS } from './identity-model.js?v=4.2.1';
import { PRODUCTS, MODULES, TIERS, BUNDLES, ROLES, WORK_PROFILES } from './catalog.js?v=4.2.1';
import { emailKey, validEmail } from './validation.js?v=4.2.1';
const clone = value => structuredClone(value);
const initialState = persona => ({
  version: 3, persona,
  modules: persona==='carrier'?{Policy:{tier:'gold',seats:0},Claims:{tier:'gold',seats:0}}:{Legal:{tier:'bronze',seats:0}},
  bundle:null,billing:'yearly',payer:{email:'',name:''},
  payment:{status:'unpaid',order:null,receipt:null},
  salesChecks:{scope:false,quantities:false},checks:{workspace:false,access:false,capacity:false,readiness:false,carrierControls:false,notifications:false},
  workspace:{name:'',slug:'',saved:false},identity:initialIdentity(persona),provisioning:{},teamReviewed:false,
  invitations:{},invitationsReviewed:false,inviteNow:false,
  config:{profile:'operations',view:'Task board',digest:'Daily',role:'member',timezone:'Asia/Kolkata',sso:'Email + password',region:'United States',rollout:'Phased rollout'},
  completed:false,salesRoute:'products',setupRoute:'workspace'
});
export class TenantModel {
  constructor(store,persona='tenant') {
    this.store=store;this.persona=persona;
    const saved=store?.load();
    this.state=saved?.version===3&&saved.persona===persona&&saved.modules&&saved.checks&&saved.salesChecks?saved:initialState(persona);
    if(!this.state.identity){this.state.identity=initialIdentity(persona);for(const users of Object.values(this.state.provisioning))for(const u of users){u.tenantUserId=crypto.randomUUID();u.membershipType='internal';}if(this.state.payment.status==='paid'){this.state.identity.moduleStates=Object.fromEntries(Object.keys(this.state.modules).map(k=>[k,{assignmentId:crypto.randomUUID(),visibility_state:'visible',enablement_state:'enabled'}]));this.state.workspace.saved=false;this.invalidateTeam();this.state.checks.workspace=false;}this.save();}
  }
  save(){this.store?.save(this.state);}
  reset(){this.state=initialState(this.persona);this.store?.clear();this.save();}
  assertUnpaid(){if(this.state.payment.status==='paid')throw new Error('This purchase is complete. License quantities are locked.');}
  assertPaid(){if(this.state.payment.status!=='paid')throw new Error('Complete your purchase before starting onboarding.');}
  invalidateSales(){this.state.salesChecks={scope:false,quantities:false};}
  selectModule(key,tier='bronze'){
    this.assertUnpaid();if(!MODULES.includes(key)||!TIERS.includes(tier))throw new Error('Choose a valid product and tier.');
    this.state.modules[key]??={tier,seats:0};this.state.modules[key].tier=tier;this.state.bundle=null;this.invalidateSales();this.save();
  }
  removeModule(key){this.assertUnpaid();delete this.state.modules[key];this.state.bundle=null;this.invalidateSales();this.save();}
  bundles(){return this.persona==='carrier'?[{id:'carrier-operations',name:'Carrier operations',description:'Policy servicing and claims operations in one purchase.',modules:{Policy:'gold',Claims:'gold'},audience:'Carrier operations'},...BUNDLES.filter(b=>b.id==='complete')]:BUNDLES;}
  applyBundle(id){
    this.assertUnpaid();const bundle=this.bundles().find(b=>b.id===id);if(!bundle)throw new Error('Choose an available bundle.');
    this.state.modules=Object.fromEntries(Object.entries(bundle.modules).map(([k,tier])=>[k,{tier,seats:this.state.modules[k]?.seats||0}]));
    this.state.bundle=id;this.invalidateSales();this.save();
  }
  setSeats(key,value){this.assertUnpaid();const n=Number(value);if(!this.state.modules[key]||!Number.isInteger(n)||n<0||n>1000)throw new Error('Enter a whole number from 0 to 1,000 seats per module.');this.state.modules[key].seats=n;this.invalidateSales();this.save();}
  setBundleSeats(value){this.assertUnpaid();const n=Number(value);if(!Number.isInteger(n)||n<1||n>1000)throw new Error('Enter 1–1,000 seats per included module.');for(const m of Object.values(this.state.modules))m.seats=n;this.invalidateSales();this.save();}
  setBilling(value){this.assertUnpaid();if(!['monthly','yearly'].includes(value))throw new Error('Choose a billing period.');this.state.billing=value;this.invalidateSales();this.save();}
  salesErrors(){const errors=[];if(!Object.keys(this.state.modules).length)errors.push('Select at least one module.');for(const[k,m]of Object.entries(this.state.modules))if(!Number.isInteger(m.seats)||m.seats<1||m.seats>1000)errors.push(`${k}: choose 1–1,000 seats, or remove the module.`);return errors;}
  quote(){
    const rate=[0,0,10,15,20][Object.keys(this.state.modules).length]||0;
    const lines=Object.entries(this.state.modules).map(([key,m])=>{const base=PRODUCTS[key].price[m.tier];const unitCents=(this.state.billing==='yearly'?base:Math.round(base*1.2))*100;const subtotalCents=unitCents*m.seats,discountCents=Math.round(subtotalCents*rate/100);return {key,tier:m.tier,seats:m.seats,unitCents,subtotalCents,discountCents,totalCents:subtotalCents-discountCents};});
    const subtotalCents=lines.reduce((n,l)=>n+l.subtotalCents,0),discountCents=lines.reduce((n,l)=>n+l.discountCents,0),monthlyCents=subtotalCents-discountCents;
    return {lines,rate,subtotalCents,discountCents,monthlyCents,periodCents:monthlyCents*(this.state.billing==='yearly'?12:1),billing:this.state.billing,licenses:lines.reduce((n,l)=>n+l.seats,0),currency:'USD'};
  }
  setSalesCheck(key,value){this.assertUnpaid();if(!Object.hasOwn(this.state.salesChecks,key))throw new Error('Unknown purchase confirmation.');this.state.salesChecks[key]=!!value;this.save();}
  updatePayer({email}){this.assertUnpaid();this.state.payer.email=String(email||'').slice(0,254);this.save();}
  recordPayment({email,accepted,outcome}){
    this.assertUnpaid();const errors=this.salesErrors();if(errors.length)throw new Error(errors.join('\n'));
    if(!validEmail(email))throw new Error('Enter a valid email for your receipt and setup access.');
    if(!this.state.salesChecks.scope||!this.state.salesChecks.quantities)throw new Error('Complete both required purchase checklist items.');
    if(!accepted)throw new Error('Confirm the billing estimate.');
    if(!['success','failed','cancelled'].includes(outcome))throw new Error('Choose a payment preview result.');
    this.state.payer.email=emailKey(email);
    if(outcome!=='success'){this.state.payment={status:outcome,order:null,receipt:null};this.save();return false;}
    // Prototype only: production must establish this state through a verified payment webhook.
    this.state.payment={status:'paid',order:clone(this.quote()),receipt:`${this.persona==='carrier'?'CARRIER':'TENANT'}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,paidAt:new Date().toISOString()};
    this.state.provisioning=Object.fromEntries(Object.keys(this.state.modules).map(k=>[k,[]]));this.state.identity.moduleStates=Object.fromEntries(Object.keys(this.state.modules).map(k=>[k,{assignmentId:crypto.randomUUID(),visibility_state:'visible',enablement_state:'enabled'}]));this.save();return true;
  }
  capacity(key){return this.state.payment.order?.lines.find(l=>l.key===key)?.seats||0;}
  setCheck(key,value){this.assertPaid();if(!Object.hasOwn(this.state.checks,key))throw new Error('Unknown setup confirmation.');this.state.checks[key]=!!value;this.state.completed=false;this.save();}
  updateWorkspaceDraft(values){this.assertPaid();for(const k of ['name','slug'])if(Object.hasOwn(values,k))this.state.workspace[k]=String(values[k]);if(Object.hasOwn(values,'ownerName'))this.state.payer.name=String(values.ownerName);for(const k of ['organizationName','legalName','tenantType','dataRegion','isolationMode'])if(Object.hasOwn(values,k))this.state.identity[k]=String(values[k]).slice(0,120);this.state.workspace.saved=false;this.state.checks.workspace=false;this.state.completed=false;this.save();}
  saveWorkspace({name,slug,ownerName,...details}){
    this.assertPaid();if(!this.state.checks.workspace)throw new Error('Confirm the workspace and owner details in the setup checklist.');
    name=String(name||'').trim();slug=String(slug||'').trim();ownerName=String(ownerName||'').trim();
    if(name.length<2||name.length>60||!ownerName||ownerName.length>80)throw new Error('Enter a workspace name (2–60 characters) and owner name.');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3||slug.length>48||['admin','api','www','support','billing'].includes(slug))throw new Error('Choose a non-reserved address using 3–48 lowercase letters, numbers, and single hyphens.');
    const identity={...this.state.identity,...details};
    if(!TENANT_TYPES[identity.tenantType]||(this.persona==='carrier'&&identity.tenantType!=='carrier')||(this.persona!=='carrier'&&identity.tenantType==='carrier')||!DATA_REGIONS[identity.dataRegion]||!['shared','dedicated'].includes(identity.isolationMode))throw new Error('Choose a valid business type, data region, and isolation preference.');
    if(!identity.organizationName.trim()||identity.organizationName.length>120)throw new Error('Enter the sign-in organization name.');
    this.state.identity={...this.state.identity,organizationName:identity.organizationName.trim(),legalName:identity.legalName.trim(),tenantType:identity.tenantType,dataRegion:identity.dataRegion,isolationMode:identity.isolationMode};
    this.state.workspace={name,slug,saved:true};this.state.payer.name=ownerName;this.save();
  }
  invalidateTeam(){this.state.teamReviewed=false;this.state.invitationsReviewed=false;this.state.checks.access=false;this.state.checks.capacity=false;this.state.completed=false;this.state.invitations={};}
  addUser(key,source={}){
    this.assertPaid();const users=this.state.provisioning[key];if(!users)throw new Error('This module is not in the paid order.');
    if(users.length>=this.capacity(key))throw new Error(`${key}: all purchased seats are allocated. Remove a draft user to free a seat.`);
    const role=source.role||'member';if(!Object.hasOwn(ROLES,role))throw new Error('Choose a valid role.');
    const existing=source.tenantUserId?this.people().find(p=>p.tenantUserId===source.tenantUserId):null;
    if(source.tenantUserId&&!existing)throw new Error('Choose an existing membership from this workspace.');
    if(existing&&users.some(u=>u.tenantUserId===existing.tenantUserId))throw new Error('This membership already has a seat in this module.');
    users.push({id:crypto.randomUUID(),tenantUserId:existing?.tenantUserId||crypto.randomUUID(),name:existing?.name||source.name||'',email:existing?.email||source.email||'',membershipType:existing?.membershipType||'internal',role});this.invalidateTeam();this.save();
  }
  updateUser(key,id,changes){
    this.assertPaid();const u=this.state.provisioning[key]?.find(u=>u.id===id);if(!u)throw new Error('User not found.');
    if(changes.role&&!Object.hasOwn(ROLES,changes.role))throw new Error('Choose a valid role.');
    if(changes.membershipType&&!MEMBERSHIP_TYPES[changes.membershipType])throw new Error('Choose a valid membership type.');
    for(const k of ['name','email','membershipType'])if(Object.hasOwn(changes,k))for(const users of Object.values(this.state.provisioning))for(const row of users)if(row.tenantUserId===u.tenantUserId)row[k]=String(changes[k]).slice(0,254);
    if(changes.role)u.role=changes.role;this.invalidateTeam();this.save();
  }
  removeUser(key,id){this.assertPaid();this.state.provisioning[key]=this.state.provisioning[key].filter(u=>u.id!==id);this.invalidateTeam();this.save();}
  people(){const people=new Map();for(const[key,users]of Object.entries(this.state.provisioning))for(const u of users){if(!validEmail(u.email))continue;if(!people.has(u.tenantUserId))people.set(u.tenantUserId,{tenantUserId:u.tenantUserId,email:emailKey(u.email),name:u.name,membershipType:u.membershipType,modules:[]});people.get(u.tenantUserId).modules.push({key,role:u.role});}return [...people.values()];}
  allocationErrors(){const errors=[];const contacts=new Map();for(const p of this.people()){if(contacts.has(p.email)&&contacts.get(p.email)!==p.tenantUserId)errors.push('This contact appears on separate membership drafts. Remove the duplicate and use Add an existing person to share access.');contacts.set(p.email,p.tenantUserId);}for(const[key,users]of Object.entries(this.state.provisioning)){if(users.length>this.capacity(key))errors.push(`${key}: the purchased seat limit has been exceeded.`);const seen=new Set();for(const[i,u]of users.entries()){const email=emailKey(u.email);if(!validEmail(email))errors.push(`${key}, user ${i+1}: enter a valid email or remove the draft.`);else if(seen.has(email))errors.push(`${key}: ${email} is assigned more than once.`);seen.add(email);if(!Object.hasOwn(ROLES,u.role))errors.push(`${key}: choose a valid role.`);}}return errors;}
  remaining(){return Object.entries(this.state.provisioning).reduce((n,[k,users])=>n+this.capacity(k)-users.length,0);}
  reviewTeam(){this.assertPaid();if(!this.state.workspace.saved)throw new Error('Save workspace details first.');const errors=this.allocationErrors();if(errors.length)throw new Error(errors.join('\n'));if(!this.state.checks.access||!this.state.checks.capacity)throw new Error('Complete the required access and unused-seat checklist items.');this.state.teamReviewed=true;this.save();}
  reviewInvitations(send){this.assertPaid();if(!this.state.teamReviewed)throw new Error('Review user provisioning first.');for(const p of this.people())this.state.invitations[p.tenantUserId]=send?'Invitation simulated · sign-in pending':'Send later';this.state.invitationsReviewed=true;this.save();}
  updateConfigDraft(changes){this.assertPaid();for(const k of ['view','digest','role','timezone','sso','region','rollout'])if(Object.hasOwn(changes,k))this.state.config[k]=String(changes[k]);this.state.checks.readiness=false;this.state.checks.carrierControls=false;this.state.completed=false;this.save();}
  setProfile(profile){this.assertPaid();if(!WORK_PROFILES[profile])throw new Error('Choose a profile.');this.state.config={...this.state.config,profile,...WORK_PROFILES[profile]};this.state.checks.readiness=false;this.state.completed=false;this.save();}
  finish(config){
    this.assertPaid();if(!this.state.workspace.saved||!this.state.teamReviewed||!this.state.invitationsReviewed)throw new Error('Complete workspace, user provisioning, and invitation review first.');
    if(!this.state.checks.workspace||!this.state.checks.access||!this.state.checks.capacity||!this.state.checks.readiness||(this.persona==='carrier'&&!this.state.checks.carrierControls))throw new Error('Complete all required setup checklist confirmations.');
    if(!['Task board','Matter list','Overview'].includes(config.view)||!['Daily','Weekly','Off'].includes(config.digest)||!Object.hasOwn(ROLES,config.role)||!['Asia/Kolkata','America/New_York','America/Los_Angeles','Europe/London','UTC'].includes(config.timezone)||!['Email + password','Microsoft Entra ID','Okta','Google Workspace'].includes(config.sso))throw new Error('Choose valid setup defaults.');
    if(this.persona==='carrier'&&(!['United States','United Kingdom','European Union','India','Multiple regions'].includes(config.region)||!['Phased rollout','Single rollout','Sandbox first'].includes(config.rollout)))throw new Error('Choose the carrier operating region and rollout approach.');
    this.state.config={...this.state.config,...config};this.state.completed=true;this.save();
  }
  setModuleState(key,field,value){
    this.assertPaid();if(!this.capacity(key))throw new Error('Only purchased modules can be configured.');
    const allowed={visibility_state:['visible','hidden'],enablement_state:['enabled','disabled']};
    if(!allowed[field]?.includes(value))throw new Error('Choose a valid module state.');
    this.state.identity.moduleStates[key]??={assignmentId:crypto.randomUUID(),visibility_state:'visible',enablement_state:'enabled'};
    this.state.identity.moduleStates[key][field]=value;this.state.checks.readiness=false;this.state.completed=false;this.save();
  }
  exportIdentity(){this.assertPaid();return identityExport(this.state,this.people());}
  nextSetup(){return !this.state.workspace.saved?'workspace':!this.state.teamReviewed?'team':!this.state.invitationsReviewed?'invitations':!this.state.completed?'configuration':'success';}
  allowedSalesRoute(route){if(this.state.payment.status==='paid')return'receipt';if(route==='checkout')return this.salesErrors().length?'products':'checkout';return'products';}
  allowedOnboardingRoute(route){if(this.state.payment.status!=='paid')return'locked';const steps=['workspace','team','invitations','configuration','success'],next=this.nextSetup();return steps.includes(route)&&steps.indexOf(route)<=steps.indexOf(next)?route:next;}
  setRoute(route,mode){this.state[mode==='sales'?'salesRoute':'setupRoute']=route;this.save();}
}
