import { esc } from '../views/helpers.js?v=3.1';
let lastFocus, timer;
export function dialog(title,html) {
  const modal=document.getElementById('modal');if(!modal.open)lastFocus=document.activeElement;
  modal.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button data-action="close" aria-label="Close dialog">×</button></div>${html}`;
  if(!modal.open)modal.showModal();
}
export function closeDialog(){document.getElementById('modal').close();}
export function initUI(){
  const modal=document.getElementById('modal');
  modal.addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus();});
  modal.addEventListener('click',event=>{if(event.target.closest('[data-action="close"]'))closeDialog();});
  document.addEventListener('click',event=>{if(event.target.closest('a[href="#main"]')){event.preventDefault();document.getElementById('main')?.focus();}});
}
export function toast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,4500);}
export function downloadJSON(filename,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function bootError(error){document.getElementById('app').innerHTML=`<main class="boot"><h1>Let’s get the preview running.</h1><p>${esc(error.message)}</p><p>Serve this folder over HTTP. From the project folder, run <code>npm start</code>, then open <a href="http://127.0.0.1:8767">the local preview</a>.</p><button class="btn" onclick="location.reload()">Try again</button></main>`;}
