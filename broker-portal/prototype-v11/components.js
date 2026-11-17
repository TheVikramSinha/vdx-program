/* Shared behavior for existing tables. Sort the entire filtered result before paging. */
S.tableSort ||= {};
const textSortV10=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
function compareV10(a,b){const empty=v=>v==null||v===''||v==='—';if(empty(a)||empty(b))return empty(a)?empty(b)?0:1:-1;return typeof a==='number'&&typeof b==='number'?a-b:textSortV10.compare(String(a),String(b));}
function tableValueV10(r,label,key){
 if(Array.isArray(r))return r[S.tableSort[key]?.column||0];
 const l=label.toLowerCase().trim(),contact=r.contacts?.find(c=>c.primary)||r.contacts?.[0]||{};
 if(key==='accounts')return ({business:r.name,'primary contact':contact.name,'phone numbers':contact.officePhone||contact.phone||contact.mobilePhone,owner:r.producer,'open submissions':accountSubs(r.id).filter(s=>!['Bound','Declined','Withdrawn'].includes(s.status)).length})[l];
 if(key==='branches')return ({branch:r.name,contact:r.email||r.phone,'users / accounts':DB.users.filter(u=>u.branch===r.name&&u.status!=='Inactive').length,status:r.status})[l];
 if(key==='user')return ({user:r.name,'role & branch':r.role+' '+r.branch,status:r.status})[l];
 if(key==='markets'||key==='carrierSelection'){
  if(l==='carriers list'||l==='carrier / market')return r.name;
  if(r.lobs?.some(x=>(x.name||x).toLowerCase()===l))return 1;
  return ({type:r.type,'naic code':r.naic,'supported lobs':r.lobs?.map(x=>x.name||x).join(', '),states:r.states?.join(', '),status:r.status})[l]??0;
 }
 if(key==='docs')return ({name:r.name,category:r.category,modified:r.updated,size:r.type==='folder'?null:r.size,'updated by':r.author||r.updatedBy})[l];
 if(['taskDashboard','homeTasks'].includes(key))return ({'task / note':r.title,type:r.kind,account:accountName(r.accountId),submission:subName(r.submissionId),due:r.kind==='Note'?null:r.due,priority:r.kind==='Note'?null:({Low:1,Medium:2,High:3,Urgent:4}[r.priority]||0),status:r.kind==='Note'?null:r.status,assignee:r.assignee})[l];
 if(['subs','accountSubs','homeSubs'].includes(key))return ({name:r.name,submission:r.name,account:accountName(r.accountId),'lines of business':r.lobs?.join(', '),effective:r.effective,submitted:r.submitted,producer:r.producer,csr:r.csr,status:r.status,updated:r.updated})[l];
 return r[label]??r[label.toLowerCase()]??r.name??r.title??'';
}
const paginateBeforeV10=paginate;
paginate=function(rows,key,per=10){const sort=S.tableSort[key];if(sort){rows=rows.map((row,index)=>({row,index})).sort((a,b)=>{const av=tableValueV10(a.row,sort.label,key),bv=tableValueV10(b.row,sort.label,key);if(av==null||av===''||av==='—')return bv==null||bv===''||bv==='—'?a.index-b.index:1;if(bv==null||bv===''||bv==='—')return -1;return compareV10(av,bv)*(sort.direction==='ascending'?1:-1)||a.index-b.index;}).map(x=>x.row);}return paginateBeforeV10(rows,key,per);};
const pagerBeforeV10=pager;
pager=function(p,label){return pagerBeforeV10(p,label).replace('class="table-footer"','class="table-footer" data-table-key="'+esc(p.key)+'"');};
function displayValueV10(cell,label){const value=(cell?.innerText||'').trim();if(!value||value==='—')return null;const l=label.toLowerCase();if(/date|modified|updated|removed|submitted|effective|due/.test(l)){const time=Date.parse(value);if(!Number.isNaN(time))return time;}
 if(/premium|fees|payable|size|days|priority|users \/ accounts/.test(l)){if(l==='priority')return {low:1,medium:2,high:3,urgent:4}[value.toLowerCase()]||0;const n=Number(value.replace(/[^\d.-]/g,''));if(Number.isFinite(n))return /\bgb\b/i.test(value)?n*1e9:/\bmb\b/i.test(value)?n*1e6:/\bkb\b/i.test(value)?n*1e3:n;}
 return value;
}
function sortVisibleTableV10(table,sort){const body=table.tBodies[0];if(!body)return;const count=(table.tHead?.rows[0]||table.rows[0]).cells.length,groups=[];for(const row of Array.from(body.rows)){if(row.cells.length===count){groups.push({row,details:[],index:groups.length,value:displayValueV10(row.cells[sort.column],sort.label)});}else if(groups.length)groups.at(-1).details.push(row);}groups.sort((a,b)=>{if(a.value==null||b.value==null)return a.value==null?b.value==null?a.index-b.index:1:-1;return compareV10(a.value,b.value)*(sort.direction==='ascending'?1:-1)||a.index-b.index;}).forEach(x=>{body.append(x.row);x.details.forEach(r=>body.append(r));});}
function enhanceTablesV10(){
 document.querySelectorAll('select[data-filter$="Sort"],select[data-doc-sort]').forEach(e=>e.remove());
 document.querySelectorAll('table').forEach((table,index)=>{
  let footer=null,wrap=table.parentElement;
  for(let node=wrap;node&&!footer&&node!==document.body;node=node.parentElement){const found=node.querySelectorAll('[data-table-key]');if(found.length===1&&node.querySelectorAll('table').length===1)footer=found[0];}
  const key=footer?.dataset.tableKey||location.hash.split('/').slice(0,4).join('/')+'-table-'+index;table.dataset.sortTable=key;table.setAttribute('aria-label',table.closest('.card')?.querySelector('h2,h3')?.textContent||'Records');
  const header=table.tHead?.rows[0]||table.rows[0];if(!header)return;
  Array.from(header.cells).forEach((th,column)=>{if(th.tagName!=='TH')return;const label=(th.textContent||'').trim();if(!label||/^(actions?|select( all)?)$/i.test(label))return;
   const sort=S.tableSort[key];th.setAttribute('scope','col');th.setAttribute('aria-sort',sort?.column===column?sort.direction:'none');
   const button=document.createElement('button');button.type='button';button.className='table-sort-button';button.dataset.sortKey=key;button.dataset.sortColumn=String(column);button.dataset.sortLabel=label;button.setAttribute('aria-label','Sort by '+label+(sort?.column===column&&sort.direction==='ascending'?', descending':', ascending'));
   button.innerHTML='<span>'+esc(label)+'</span><span aria-hidden="true" class="sort-indicator">'+(sort?.column===column?sort.direction==='ascending'?'↑':'↓':'↕')+'</span>';
   if(th.querySelector('input,button')){const span=th.querySelector('label>span');if(span)span.remove();th.append(button);}else th.replaceChildren(button);
  });if(!footer&&S.tableSort[key])sortVisibleTableV10(table,S.tableSort[key]);
 });
 document.querySelectorAll('input[data-filter],input[data-global-search]').forEach(el=>{el.type='search';el.autocomplete='off';});
}
const renderBeforeV10=render;
render=function(){renderBeforeV10();enhanceTablesV10();};
document.addEventListener('click',e=>{const button=e.target.closest('[data-sort-key]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();const key=button.dataset.sortKey,column=Number(button.dataset.sortColumn),old=S.tableSort[key];S.tableSort[key]={column,label:button.dataset.sortLabel,direction:old?.column===column&&old.direction==='ascending'?'descending':'ascending'};S.filters[key+'Page']=1;
 const table=button.closest('table');if(table.parentElement.closest('.card')?.querySelector('[data-table-key="'+CSS.escape(key)+'"]')||document.querySelector('[data-table-key="'+CSS.escape(key)+'"]')){renderKeep();document.querySelector('[data-sort-key="'+CSS.escape(key)+'"][data-sort-column="'+column+'"]')?.focus();}else {sortVisibleTableV10(table,S.tableSort[key]);Array.from(table.querySelectorAll('th')).forEach((th,i)=>{th.setAttribute('aria-sort',i===column?S.tableSort[key].direction:'none');const b=th.querySelector('.table-sort-button');if(b){b.querySelector('.sort-indicator').textContent=i===column?(S.tableSort[key].direction==='ascending'?'↑':'↓'):'↕';b.setAttribute('aria-label','Sort by '+b.dataset.sortLabel+(i===column&&S.tableSort[key].direction==='ascending'?', descending':', ascending'));}});}
},true);
// Filtering always starts at the first page, including multi-select filters.
function resetFilterPageV10(key){const prefixes=['homeTasks','homeSubs','accounts','branches','user','markets','accountSubs','subs','taskDashboard','carrierSelect'];const prefix=prefixes.find(p=>key.startsWith(p));if(prefix)S.filters[(prefix==='carrierSelect'?'carrierSelection':prefix)+'Page']=1;}
document.addEventListener('change',e=>{if(e.target.dataset.filter)resetFilterPageV10(e.target.dataset.filter);},true);
const actionBeforeV10=handleAction;
handleAction=async function(action,d,el){if(action==='multi-filter')resetFilterPageV10(d.key);if(action==='switch-branch')for(const k of Object.keys(S.filters))if(k.endsWith('Page'))S.filters[k]=1;return actionBeforeV10(action,d,el);};

// Protect edits in the existing modal forms when cancelled or dismissed.
function editedModalV10(){return document.querySelector('#modal-root form[data-v10-dirty="true"]');}
function markModalV10(e){const form=e.target.closest('#modal-root form');if(form)form.dataset.v10Dirty='true';}
document.addEventListener('input',markModalV10,true);document.addEventListener('change',markModalV10,true);
function requestModalDiscardV10(e){if(!editedModalV10())return false;e.preventDefault();e.stopImmediatePropagation();confirmAction('Discard unsaved changes?','Your changes in this form have not been saved.',()=>{S.v7Dirty=false;closeModal(true);},'Discard changes',true);return true;}
document.addEventListener('click',e=>{if(e.target.closest('#modal-root [data-action="close-modal"]'))requestModalDiscardV10(e);},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#popover-root > *'))requestModalDiscardV10(e);},true);
const actionBeforeExportV10=handleAction;
handleAction=async function(action,d,el){if(action==='export-accounts'){
 const rows=DB.accounts.filter(a=>!a.archived&&branchVisible(a)&&match([a.name,primaryContact(a)?.name,primaryContact(a)?.email,a.naics,naicsLabel(a.naics),primaryContact(a)?.officePhone,primaryContact(a)?.mobilePhone].join(' '),S.filters.accountsQ)&&(!S.filters.accountsType||a.type===S.filters.accountsType)&&(!S.filters.accountsProducer||a.producer===S.filters.accountsProducer));
 const sort=S.tableSort.accounts;if(sort)rows.sort((a,b)=>compareV10(tableValueV10(a,sort.label,'accounts'),tableValueV10(b,sort.label,'accounts'))*(sort.direction==='ascending'?1:-1));
 return exportCSV('Veridex-Accounts.csv',[['Account','Primary Contact','Office Phone','Mobile Phone','Email','NAICS','Industry','Producer','CSR'],...rows.map(a=>{const c=primaryContact(a)||{};return [a.name,c.name,c.officePhone||c.phone,c.mobilePhone,c.email,a.naics,naicsLabel(a.naics),a.producer,a.csr];})]);
 }if(action==='v9-clear-table'){delete S.tableSort[d.key];}if(action==='v7-clear-accounts')delete S.tableSort.accounts;return actionBeforeExportV10(action,d,el);};
// Make the existing popovers and feedback usable without a mouse.
const popoverBeforeV10=popover,closePopoverBeforeV10=closePopover;
let popoverAnchorV10=null;
popover=function(html,anchor,width){popoverBeforeV10(html,anchor,width);popoverAnchorV10=anchor||null;const panel=document.querySelector('#popover-root .popover');if(panel){panel.id='active-popover';panel.setAttribute('aria-label',anchor?.getAttribute('aria-label')||anchor?.textContent?.trim()||'Options');}if(anchor){anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls','active-popover');}};
closePopover=function(){const anchor=popoverAnchorV10;closePopoverBeforeV10();if(anchor){anchor.setAttribute('aria-expanded','false');anchor.removeAttribute('aria-controls');}popoverAnchorV10=null;};
document.addEventListener('keydown',e=>{const panel=document.querySelector('#popover-root .popover');if(!panel)return;const items=Array.from(panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)')).filter(el=>!el.hidden);if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const anchor=popoverAnchorV10;closePopover();anchor?.focus();return;}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&!e.target.matches('input,textarea,select')){e.preventDefault();e.stopImmediatePropagation();const i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?(i+1)%items.length:(i-1+items.length)%items.length]?.focus();}},true);
const toastBeforeV10=toast;
toast=function(message,error=false){toastBeforeV10(message,error);const t=document.querySelector('#toasts .toast:last-child');if(t){t.setAttribute('role',error?'alert':'status');t.setAttribute('aria-live',error?'assertive':'polite');}};
const openModalBeforeV10=openModal,closeModalBeforeV10=closeModal;
let modalTriggerV10=null;
openModal=function(...args){if(!document.querySelector('#modal-root > *'))modalTriggerV10=document.activeElement;return openModalBeforeV10(...args);};
closeModal=function(...args){const result=closeModalBeforeV10(...args);if(!document.querySelector('#modal-root > *')&&modalTriggerV10?.isConnected){modalTriggerV10.focus();modalTriggerV10=null;}return result;};
const enhanceTablesBeforeLabelsV10=enhanceTablesV10;
enhanceTablesV10=function(){enhanceTablesBeforeLabelsV10();document.querySelectorAll('button[data-action]').forEach(button=>{if(!button.textContent.trim()&&!button.getAttribute('aria-label')){const label=button.dataset.action.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());button.setAttribute('aria-label',label);button.title=label;}});};
