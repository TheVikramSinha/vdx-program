// Illustrative demo catalog. Names, compositions and prices are DEMO ASSUMPTIONS, not confirmed VeriDex offers.
const P = ['tenant', 'carrier'];
const tiers = (std, adv) => [
  { id: 'standard', name: 'Standard', features: std },
  { id: 'advanced', name: 'Advanced', features: adv },
];
export const ROLES = ['Viewer', 'Contributor', 'Manager'];
export const PRODUCT_KINDS = { module: 'Module (seat-based)', platform: 'Platform access (per user)', addon: 'Add-on (workspace-wide)', service: 'Setup service (one-time)' };
/** Licence metric: how a SKU is measured and charged. */
export const LICENSE_METRICS = {
  per_user: { label: 'Per user', unit: 'per user / month', hint: 'One licence per person who uses any module' },
  per_module: { label: 'Per module seat', unit: 'per seat / month', hint: 'A seat in each module a person uses' },
  flat: { label: 'Flat fee', unit: 'per month', hint: 'Fixed price, any number of users' },
  usage: { label: 'Usage', unit: 'per unit', hint: 'Charged on what you use, billed monthly in arrears' },
};
export const CHARGE_TYPES = { recurring: 'Recurring', one_time: 'One-time' };
export function seedCatalog() {
  const products = [
    { id: 'mod_policy', kind: 'module', code: 'POL', name: 'Policy', summary: 'Quote, bind and service policies.', description: 'Policy lifecycle workspace: submissions, quoting, endorsements and renewals.', personas: P, status: 'active',
      tiers: tiers(['Submission intake', 'Quote & bind', 'Renewal queue'], ['Everything in Standard', 'Rules-based underwriting referrals', 'Bulk endorsements']) },
    { id: 'mod_claims', kind: 'module', code: 'CLM', name: 'Claims', summary: 'Intake to settlement in one file.', description: 'Claims workspace: first notice of loss, reserves, payments and recovery.', personas: P, status: 'active',
      tiers: tiers(['FNOL intake', 'Claim file & diary', 'Payment requests'], ['Everything in Standard', 'Reserve authority workflows', 'Subrogation tracking']) },
    { id: 'mod_legal', kind: 'module', code: 'LGL', name: 'Legal', summary: 'Matters, counsel and litigation spend.', description: 'Legal workspace: matter management, panel counsel and litigation budgets.', personas: P, status: 'active',
      tiers: tiers(['Matter register', 'Counsel assignment', 'Document holds'], ['Everything in Standard', 'Litigation budgets', 'Outcome analytics']) },
    { id: 'mod_insights', kind: 'module', code: 'INS', name: 'Risk Insights', summary: 'Portfolio and telematics signals.', description: 'Analytics workspace: loss ratios, exposure views and telematics risk signals.', personas: P, status: 'active',
      tiers: tiers(['Standard dashboards', 'Scheduled exports'], ['Everything in Standard', 'Custom measures', 'Telematics risk scoring']) },
    { id: 'mod_submit', kind: 'module', code: 'SUB', name: 'Submission Builder', summary: 'Commercial submissions to many markets.', description: 'Build one commercial submission and send it to several markets. Seat-based.', personas: ['tenant'], status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Shared application builder', 'Market selection', 'Quote comparison'] }] },
    // Platform access, licence metric "per user": every person who holds any module seat needs one user licence.
    { id: 'mod_core', kind: 'platform', code: 'CORE', name: 'VeriDex Core', summary: 'Platform access for each person.', description: 'Sign-in, workspace, documents, workflow and notifications. One user licence per person who uses any module.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Single sign-in across modules', 'Documents, tasks and notifications', 'Administrators who use no module are free'] }] },
    // Add-ons, licence metric "flat" or "usage": workspace-wide, no per-person seat.
    { id: 'mod_portal', kind: 'addon', code: 'PRT', name: 'Client Portal', summary: 'Self-service portal for your insureds.', description: 'Branded portal where insureds view policies, download documents and request changes.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Branded insured portal', 'Document downloads', 'Change requests'] }] },
    { id: 'mod_ai', kind: 'addon', code: 'AI', name: 'AI Assistant', summary: 'Document extraction and drafting help.', description: 'Reads submissions and loss runs and drafts summaries. Every AI output is logged and reviewed by a person.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Document extraction', 'Draft summaries', 'Human review on every output'] }] },
    { id: 'mod_pay', kind: 'addon', code: 'PAY', name: 'Digital Payments', summary: 'Card and bank payments from insureds.', description: 'Collect premium online. Charged per successful payment after a monthly included allowance.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Card and bank transfer', 'Payment links', 'Automatic receipts'] }] },
    // One-time setup services: charged once, never renew, no SMA.
    { id: 'svc_migration', kind: 'service', code: 'MIG', name: 'Data migration', summary: 'Move records from your current system.', description: 'Mapping, test load and final load. Priced per source system.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Field mapping workshop', 'Test load and reconciliation', 'Final load'] }] },
    { id: 'svc_config', kind: 'service', code: 'CFG', name: 'Initial configuration', summary: 'Workspace set up with our team.', description: 'Roles, templates, workflows and module settings configured with you.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Roles and permissions', 'Document templates', 'Workflow rules'] }] },
    { id: 'svc_training', kind: 'service', code: 'TRN', name: 'Private staff training', summary: 'Live sessions for your team.', description: 'Remote session for up to 12 attendees, tailored to your modules. Priced per session.', personas: P, status: 'active',
      tiers: [{ id: 'standard', name: 'Standard', features: ['Live remote session', 'Recording supplied', 'Up to 12 attendees'] }] },
  ];
  const prices = {
    'mod_submit:standard': 2200, 'mod_core:standard': 1500, 'mod_portal:standard': 25000, 'mod_ai:standard': 30000, 'mod_pay:standard': 75,
    'svc_migration:standard': 250000, 'svc_config:standard': 150000, 'svc_training:standard': 60000,
    'mod_policy:standard': 3600, 'mod_policy:advanced': 5400,
    'mod_claims:standard': 4200, 'mod_claims:advanced': 6400,
    'mod_legal:standard': 5800, 'mod_legal:advanced': 8400,
    'mod_insights:standard': 2800, 'mod_insights:advanced': 4600,
  };
  const skus = [];
  const BASE = { type: 'standalone', status: 'published', discountBps: 0, chargeType: 'recurring' };
  for (const p of products.filter((x) => x.kind === 'module')) for (const t of p.tiers) {
    skus.push({ ...BASE, id: `VDX-${p.code}-${t.id === 'standard' ? 'STD' : 'ADV'}`, name: `${p.name} ${t.name}`, audience: [...p.personas], licenseMetric: 'per_module',
      description: `${p.name} module, ${t.name} tier. One seat per person who uses ${p.name}.`,
      components: [{ productId: p.id, tierId: t.id }], quantityRule: { type: 'per_module', min: 1, max: 500 } });
  }
  const one = (productId) => [{ productId, tierId: 'standard' }];
  skus.push(
    { ...BASE, id: 'VDX-CORE-USR', name: 'VeriDex Core user licence', audience: [...P], licenseMetric: 'per_user', components: one('mod_core'), quantityRule: { type: 'per_module', min: 1, max: 2000 },
      description: 'Platform access. One licence per person who uses any module. Administrators who use no module need none.' },
    { ...BASE, id: 'VDX-ADD-PORTAL', name: 'Client Portal', audience: [...P], licenseMetric: 'flat', components: one('mod_portal'), quantityRule: { type: 'flat', min: 1, max: 1, unitLabel: 'workspace' },
      description: 'Flat monthly fee for the whole workspace, any number of insureds.' },
    { ...BASE, id: 'VDX-ADD-AI', name: 'AI Assistant', audience: [...P], licenseMetric: 'flat', components: one('mod_ai'), quantityRule: { type: 'flat', min: 1, max: 1, unitLabel: 'workspace' },
      description: 'Flat monthly fee for the whole workspace.' },
    { ...BASE, id: 'VDX-ADD-PAY', name: 'Digital Payments', audience: [...P], licenseMetric: 'usage', components: one('mod_pay'), quantityRule: { type: 'usage', min: 0, max: 0 }, usage: { unitLabel: 'payment', includedUnits: 100 },
      description: 'No monthly fee. Each successful payment after the included allowance is charged, billed monthly in arrears.' },
    { ...BASE, id: 'VDX-SVC-MIG', chargeType: 'one_time', name: 'Data migration', audience: [...P], licenseMetric: 'flat', components: one('svc_migration'), quantityRule: { type: 'flat', min: 1, max: 5, unitLabel: 'source system' },
      description: 'One-time fee per source system migrated.' },
    { ...BASE, id: 'VDX-SVC-CFG', chargeType: 'one_time', name: 'Initial configuration', audience: [...P], licenseMetric: 'flat', components: one('svc_config'), quantityRule: { type: 'flat', min: 1, max: 1, unitLabel: 'engagement' },
      description: 'One-time fee for setting up your workspace with you.' },
    { ...BASE, id: 'VDX-SVC-TRN', chargeType: 'one_time', name: 'Private staff training', audience: [...P], licenseMetric: 'flat', components: one('svc_training'), quantityRule: { type: 'flat', min: 1, max: 20, unitLabel: 'session' },
      description: 'One-time fee per live session.' },
  );
  const bundle = (id, name, audience, description, comps, discountBps) => ({ id, type: 'bundle', name, audience, description, status: 'published', licenseMetric: 'per_module', chargeType: 'recurring',
    components: comps.map(([productId, tierId]) => ({ productId, tierId })), quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps });
  skus.push(
    bundle('VDX-BND-CL', 'Claims & Legal', [...P], 'Claims and Legal together. Choose a seat count for each module.', [['mod_claims', 'standard'], ['mod_legal', 'standard']], 1000),
    bundle('VDX-BND-SUITE', 'Complete Suite', [...P], 'All four modules at Standard tier. A separate seat count per module.', [['mod_policy', 'standard'], ['mod_claims', 'standard'], ['mod_legal', 'standard'], ['mod_insights', 'standard']], 1800),
    bundle('VDX-BND-CO', 'Carrier Operations', ['carrier'], 'Policy and Claims at Advanced tier for carrier operating teams.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced']], 1200),
    bundle('VDX-BND-CSUITE', 'Carrier Complete Suite', ['carrier'], 'All four modules at Advanced tier for multi-region carriers.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced'], ['mod_legal', 'advanced'], ['mod_insights', 'advanced']], 2000),
    { id: 'VDX-BND-TEAM5', type: 'bundle', name: 'Team Pack 5+5', audience: ['tenant'], status: 'published', licenseMetric: 'per_module', chargeType: 'recurring',
      description: 'Fixed package: 5 Claims seats and 5 Legal seats per pack. Not customizable; add standalone seats if you need more of one module.',
      components: [{ productId: 'mod_claims', tierId: 'standard', fixedSeats: 5 }, { productId: 'mod_legal', tierId: 'standard', fixedSeats: 5 }],
      quantityRule: { type: 'fixed_package', min: 1, max: 50 }, discountBps: 0, packagePriceMinor: 42000 },
  );
  return { products, skus, prices, settings: { currency: 'USD', annualDiscountBps: 1000, taxBps: 825, smaBps: 1500, requirePlatformLicence: true } };
}
