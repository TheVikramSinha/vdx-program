// Tests business rules directly with an isolated in-memory browser-data adapter.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('Veridex-Interactive-Broker-Portal-Prototype 11.html','utf8');
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const nodes={};for(const [,attrs,body]of scripts){const id=attrs.match(/id="([^"]+)"/);if(id)nodes['#'+id[1]]={textContent:body};}
const store=new Map(),messages=[];
const ctx={console,Date,Intl,Set,Map,JSON,Math,Number,String,Array,Object,RegExp,Promise,URL,Blob,Uint8Array,TextEncoder,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},location:{hash:'#/dashboard'},history:{replaceState(){}},window:{addEventListener(){}},document:{getElementById:id=>nodes['#'+id]||null,querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener(){}},FormData:class{constructor(form){this.values=form.values}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]()}}};
vm.createContext(ctx);for(const [,attrs,body]of scripts)if(!attrs.includes('application/json'))vm.runInContext(body.replace(/\nboot\(\);/,'\n'),ctx);
vm.runInContext('ensureV7(); render=()=>{}; toast=(m)=>messages.push(m); closeModal=()=>{}; openModal=()=>{};',Object.assign(ctx,{messages}));
const run=s=>vm.runInContext(s,ctx),data=()=>run('DB');
const form=(name,values,id='')=>({dataset:{form:name,id},values,querySelectorAll:()=>[]});
(async()=>{
 assert.equal(run('STORAGE_KEY'),'veridex-broker-prototype-v11');
 assert.ok(!run('shell("test")').includes('data-action="branches"'));
 assert.ok(!run('agencyNavigationV7()').includes('#/admin/overview'));
 assert.ok(!run('agencyNavigationV7()').includes('#/admin/branches'));
 assert.ok(!run('adminView()').includes('Agency overview'));
 assert.ok(!run('agencyView()').includes('Agency licence'));
 assert.ok(!run('usersView()').includes('Role & branch'));
 assert.ok(run('rolesView()').includes('Roles & Permissions'));
 assert.ok(run('rolesView()').includes('Define what each role can access'));
 const summary=run('accountsView("a1")');assert.ok(!summary.includes('Manage contacts'));assert.ok(summary.includes('Mailing address'));
 run("S.editingAccount='a1'");const editor=run('accountsView("a1")');assert.ok(editor.includes('Mailing Address'));assert.ok(editor.includes('name="mailingStreet"'));assert.ok(!editor.includes('name="branch"'));
 ctx.f=form('account',{mailingStreet:'100 Main St',mailingCity:'Austin',mailingState:'TX',mailingZip:'787011234'},'a1');const d=run('captureAccountDraft(f)');assert.equal(d.mailingAddress.zip,'78701-1234');assert.equal(d.mailingAddress.street,'100 Main St');assert.equal(d.street,'4820 W Harbor Dr');
 ctx.f.values={mailingStreet:'',mailingCity:'',mailingState:'',mailingZip:''};run('captureAccountDraft(f)');assert.equal(run('getAccountDraft(account("a1")).mailingAddress.street'),'');
 run("S.tableSort.accounts={column:0,label:'Business',direction:'descending'}");assert.ok(run("paginate(DB.accounts,'accounts',10).items").length);
 assert.equal(run("branchVisible({branch:'anything'})"),true);
 console.log('Passed: removed agency overview/licence/branch controls; prototype 5 roles layout; mailing draft capture and clearing; primary-address preservation; header sorting; isolated storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
