import {mountChat} from './controllers/chat-controller.js?v=4.2.1';
import { AssistanceModel } from './models/assistance-model.js?v=4.2.1';
import { AssistedView } from './views/assisted-view.js?v=4.2.1';
import { AssistanceController } from './controllers/assistance-controller.js?v=4.2.1';
import { SessionStore } from './services/session-store.js?v=4.2.1';
import { Templates } from './services/templates.js?v=4.2.1';
import { initUI, bootError } from './services/ui.js?v=4.2.1';
try {
  const templates=new Templates();await templates.load(new URL('./views/templates/assisted.html',import.meta.url));
  const persona=new URLSearchParams(location.search).get('persona')==='carrier'?'carrier':'tenant';
  const tenant=new SessionStore(`vdx:mvc:${persona}:v3`).load();
  const selected=tenant?.persona===persona?Object.keys(tenant.modules||{}):[];
  initUI();new AssistanceController(new AssistanceModel(new SessionStore(`vdx:mvc:assistance:${persona}:v2`),selected,persona),new AssistedView(document.getElementById('app'),templates)).start();
  mountChat({persona,context:()=>({experience:'assistance',step:'intake',modules:selected})});
}catch(error){bootError(error);}
