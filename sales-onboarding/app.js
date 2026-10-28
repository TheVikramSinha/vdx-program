import { TenantModel } from './models/tenant-model.js?v=3.1';
import { CarrierModel } from './models/carrier-model.js?v=3.1';
import { TenantView } from './views/tenant-view.js?v=3.1';
import { TenantController } from './controllers/tenant-controller.js?v=3.1';
import { CarrierController } from './controllers/carrier-controller.js?v=3.1';
import { SessionStore } from './services/session-store.js?v=3.1';
import { Templates } from './services/templates.js?v=3.1';
import { initUI, bootError } from './services/ui.js?v=3.1';
try {
  const persona=document.body.dataset.persona||'tenant',mode=document.body.dataset.experience||'sales';
  const templates=new Templates();await templates.load(new URL('./views/templates/tenant.html',import.meta.url));
  const store=new SessionStore(`vdx:mvc:${persona}:v3`);
  const model=persona==='carrier'?new CarrierModel(store):new TenantModel(store);
  const Controller=persona==='carrier'?CarrierController:TenantController;
  initUI();new Controller(model,new TenantView(document.getElementById('app'),templates,mode),mode).start();
}catch(error){bootError(error);}
