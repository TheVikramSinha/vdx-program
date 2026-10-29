// ERD 01a: setup intent only. Provider identities and platform projections are server-owned.
export const TENANT_TYPES={carrier:'Carrier',mga:'MGA',mgu:'MGU',broker:'Broker',wholesaler:'Wholesaler',legal_department:'Legal department'};
export const MEMBERSHIP_TYPES={internal:'Internal',partner:'Partner',insured:'Insured',service:'Service'};
export const DATA_REGIONS={pending:'Confirm with implementation team',us:'United States',eu:'European Union',uk:'United Kingdom',india:'India'};
export const initialIdentity=persona=>({
  identityTenantId:crypto.randomUUID(),tenantId:crypto.randomUUID(),ownerUserId:crypto.randomUUID(),
  organizationName:'',legalName:'',tenantType:persona==='carrier'?'carrier':'legal_department',
  dataRegion:'pending',isolationMode:'shared',moduleStates:{}
});
export function identityExport(s,people){
  const i=s.identity;
  return {
    kind:'identity-tenant-setup-intent',schemaReference:'01a_identity_tenant.svg',productionProvisioned:false,
    identity_tenant:{identity_tenant_id:i.identityTenantId,display_name:i.organizationName,status:'pending'},
    tenant:{tenant_id:i.tenantId,identity_tenant_id:i.identityTenantId,party_id:null,tenant_code:s.workspace.slug,tenant_name:s.workspace.name,tenant_type:i.tenantType,isolation_mode:i.isolationMode,data_region:i.dataRegion==='pending'?null:i.dataRegion,is_enabled:false,status:'pending'},
    legal_entity_intent:{display_name:i.legalName||null,party_resolution:'pending'},
    sign_in_intent:{preference:s.config.sso,verified:false},
    // Never invent provider+issuer+subject or use an email as an external identity ID.
    external_identity:[],
    tenant_user:[{tenant_user_id:i.ownerUserId,tenant_id:i.tenantId,external_identity_id:null,party_id:null,persona_id:null,membership_type:'internal',status:'invited',enrolled_at:null},...people.map(p=>({tenant_user_id:p.tenantUserId,tenant_id:i.tenantId,external_identity_id:null,party_id:null,persona_id:null,membership_type:p.membershipType,status:'invited',enrolled_at:null}))],
    pending_contacts:[{tenant_user_id:i.ownerUserId,name:s.payer.name,email:s.payer.email,purpose:'administrator nomination'},...people.map(p=>({tenant_user_id:p.tenantUserId,name:p.name,email:p.email,purpose:'membership invitation'}))],
    // Module-user roles are a prototype extension pending the Module 1B authorization ERD.
    module_access_intent:people.flatMap(p=>p.modules.map(m=>({tenant_user_id:p.tenantUserId,module_key:m.key,role_preference:m.role}))),
    tenant_module_assignment:s.payment.order.lines.map(l=>({tenant_module_assignment_id:i.moduleStates[l.key].assignmentId,tenant_id:i.tenantId,module_entitlement_projection_id:null,module_key:l.key,visibility_state:i.moduleStates[l.key].visibility_state,enablement_state:i.moduleStates[l.key].enablement_state,changed_by_user_id:i.ownerUserId,assigned_at:null})),
    billing_reference:{receipt:s.payment.receipt,seat_quantities:s.payment.order.lines.map(l=>({module_key:l.key,seats:l.seats}))},
    pending_server_data:['license_projection','module_entitlement_projection','feature_entitlement_projection','party references','authorization personas','provider identity verification'],
    limits:{max_tenants:null,max_tenant_instances:null,note:'Not supplied by this ERD or the mock checkout. Seat counts do not imply tenant-instance limits.'},
    org_unit:[],tenant_user_org_unit:[],tenant_feature_state:[],user_consent:[],api_client:[],access_delegation:[]
  };
}
