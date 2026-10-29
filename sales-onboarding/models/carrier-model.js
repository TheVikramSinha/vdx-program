import { TenantModel } from './tenant-model.js?v=4.2.1';
/** Carrier-specific catalog, identity, storage and readiness gates; shared license engine. */
export class CarrierModel extends TenantModel {
  constructor(store){super(store,'carrier');}
}
