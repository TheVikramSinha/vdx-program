import { AssistanceModel } from './models/assistance-model.js?v=3.1';
import { AssistedView } from './views/assisted-view.js?v=3.1';
import { AssistanceController } from './controllers/assistance-controller.js?v=3.1';
import { SessionStore } from './services/session-store.js?v=3.1';
import { Templates } from './services/templates.js?v=3.1';
import { initUI, bootError } from './services/ui.js?v=3.1';
try {
  const templates=new Templates();await templates.load(new URL('./views/templates/assisted.html',import.meta.url));
  const tenant=new SessionStore('vdx:mvc:tenant:v3').load();
  const selected=tenant?.persona==='tenant'?Object.keys(tenant.modules||{}):[];
  initUI();new AssistanceController(new AssistanceModel(new SessionStore('vdx:mvc:assistance:v2'),selected),new AssistedView(document.getElementById('app'),templates)).start();
}catch(error){bootError(error);}
