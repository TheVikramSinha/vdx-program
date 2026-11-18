// Illustrative demo catalog. Names, compositions, metrics and prices are DEMO ASSUMPTIONS, not confirmed VeriDex offers.
// v4: each product enables one or more licence metrics (and may define new/custom metrics); prices are per product, tier and metric.
const P = ['tenant', 'carrier'];
const tiers = (std, adv) => [
  { id: 'standard', name: 'Standard', features: std },
  { id: 'advanced', name: 'Advanced', features: adv },
];
export const ROLES = ['Viewer', 'Contributor', 'Manager'];
export const PRODUCT_KINDS = { module: 'Module (users get access)', platform: 'Platform access (per user)', addon: 'Add-on (workspace-wide)', service: 'Setup service (one-time)' };
export const CHARGE_TYPES = { recurring: 'Recurring', one_time: 'One-time' };
const on = (key, extra = {}) => ({ key, enabled: true, ...extra });
const off = (key, extra = {}) => ({ key, enabled: false, ...extra });
export function seedCatalog() {
  const products = [
    { id: 'mod_policy', kind: 'module', code: 'POL', name: 'Policy', summary: 'Quote, bind and service policies.', description: 'Policy lifecycle workspace: submissions, quoting, endorsements and renewals.', personas: P, status: 'active',
      metrics: [on('per_seat'), on('per_module'), off('per_usage', { unitLabel: 'policy issued', includedUnits: 200 })],
      tiers: tiers(['Submission intake', 'Quote & bind', 'Renewal queue'], ['Everything in Standard', 'Rules-based underwriting referrals', 'Bulk endorsements']) },
    { id: 'mod_claims', kind: 'module', code: 'CLM', name: 'Claims', summary: 'Intake to settlement in one file.', description: 'Claims workspace: first notice of loss, reserves, payments and recovery.', personas: P, status: 'active',
      metrics: [on('per_seat'), on('per_module'), on('per_usage', { unitLabel: 'claim opened', includedUnits: 50 })],
      tiers: tiers(['FNOL intake', 'Claim file & diary', 'Payment requests'], ['Everything in Standard', 'Reserve authority workflows', 'Subrogation tracking']) },
    { id: 'mod_legal', kind: 'module', code: 'LGL', name: 'Legal', summary: 'Matters, counsel and litigation spend.', description: 'Legal workspace: matter management, panel counsel and litigation budgets.', personas: P, status: 'active',
      metrics: [on('per_seat'), on('per_module'), off('per_usage', { unitLabel: 'matter', includedUnits: 20 })],
      tiers: tiers(['Matter register', 'Counsel assignment', 'Document holds'], ['Everything in Standard', 'Litigation budgets', 'Outcome analytics']) },
    { id: 'mod_insights', kind: 'module', code: 'INS', name: 'Risk Insights', summary: 'Portfolio and telematics signals.', description: 'Analytics workspace: loss ratios, exposure views and telematics risk signals.', personas: P, status: 'active',
      metrics: [on('per_seat'), on('per_module'), off('per_usage', { unitLabel: 'report', includedUnits: 100 }),
        // A new/custom metric, explicitly marked as such by the catalog manager.
        { key: 'custom_vehicle', enabled: true, isCustom: true, name: 'Per vehicle', basis: 'quantity', unitLabel: 'vehicle', min: 1, max: 100000, description: 'Priced per telematics-connected vehicle monitored each month.' }],
      tiers: tiers(['Standard dashboards', 'Scheduled exports'], ['Everything in Standard', 'Custom measures', 'Telematics risk scoring']) },
    { id: 'mod_submit', kind: 'module', code: 'SUB', name: 'Submission Builder', summary: 'Commercial submissions to many markets.', description: 'Build one commercial submission and send it to several markets.', personas: ['tenant'], status: 'active',
      metrics: [on('per_seat'), off('per_module'), off('per_usage', { unitLabel: 'submission', includedUnits: 25 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Shared application builder', 'Market selection', 'Quote comparison'] }] },
    // Platform access: every person who can use any module needs one user licence.
    { id: 'mod_core', kind: 'platform', code: 'CORE', name: 'VeriDex Core', summary: 'Platform access for each person.', description: 'Sign-in, workspace, documents, workflow and notifications. One user licence per person who uses any module.', personas: P, status: 'active',
      metrics: [on('per_seat')],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Single sign-in across modules', 'Documents, tasks and notifications', 'Administrators who use no module are free'] }] },
    // Add-ons: workspace-wide, no per-person seat.
    { id: 'mod_portal', kind: 'addon', code: 'PRT', name: 'Client Portal', summary: 'Self-service portal for your insureds.', description: 'Branded portal where insureds view policies, download documents and request changes.', personas: P, status: 'active',
      metrics: [on('flat', { unitLabel: 'workspace', min: 1, max: 1 }), on('per_usage', { unitLabel: 'active insured', includedUnits: 500 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Branded insured portal', 'Document downloads', 'Change requests'] }] },
    { id: 'mod_ai', kind: 'addon', code: 'AI', name: 'AI Assistant', summary: 'Document extraction and drafting help.', description: 'Reads submissions and loss runs and drafts summaries. Every AI output is logged and reviewed by a person.', personas: P, status: 'active',
      metrics: [on('flat', { unitLabel: 'workspace', min: 1, max: 1 }), on('per_usage', { unitLabel: 'document', includedUnits: 500 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Document extraction', 'Draft summaries', 'Human review on every output'] }] },
    { id: 'mod_pay', kind: 'addon', code: 'PAY', name: 'Digital Payments', summary: 'Card and bank payments from insureds.', description: 'Collect premium online. Charged per successful payment after a monthly included allowance.', personas: P, status: 'active',
      metrics: [off('flat', { unitLabel: 'workspace', min: 1, max: 1 }), on('per_usage', { unitLabel: 'payment', includedUnits: 100 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Card and bank transfer', 'Payment links', 'Automatic receipts'] }] },
    // One-time setup services: charged once, never renew, no SMA.
    { id: 'svc_migration', kind: 'service', code: 'MIG', name: 'Data migration', summary: 'Move records from your current system.', description: 'Mapping, test load and final load. Priced per source system.', personas: P, status: 'active',
      metrics: [on('flat', { unitLabel: 'source system', min: 1, max: 5 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Field mapping workshop', 'Test load and reconciliation', 'Final load'] }] },
    { id: 'svc_config', kind: 'service', code: 'CFG', name: 'Initial configuration', summary: 'Workspace set up with our team.', description: 'Roles, templates, workflows and module settings configured with you.', personas: P, status: 'active',
      metrics: [on('flat', { unitLabel: 'engagement', min: 1, max: 1 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Roles and permissions', 'Document templates', 'Workflow rules'] }] },
    { id: 'svc_training', kind: 'service', code: 'TRN', name: 'Private staff training', summary: 'Live sessions for your team.', description: 'Remote session for up to 12 attendees, tailored to your modules. Priced per session.', personas: P, status: 'active',
      metrics: [on('flat', { unitLabel: 'session', min: 1, max: 20 })],
      tiers: [{ id: 'standard', name: 'Standard', features: ['Live remote session', 'Recording supplied', 'Up to 12 attendees'] }] },
  ];
  // Price book: product : tier : metric → minor units. per_seat = per seat or user / month; per_module & flat = per unit / month (or once for services);
  // per_usage = per unit used after the included allowance; custom quantity = per unit / month.
  const prices = {
    'mod_policy:standard:per_seat': 3600, 'mod_policy:advanced:per_seat': 5400, 'mod_policy:standard:per_module': 180000, 'mod_policy:advanced:per_module': 270000, 'mod_policy:standard:per_usage': 120, 'mod_policy:advanced:per_usage': 180,
    'mod_claims:standard:per_seat': 4200, 'mod_claims:advanced:per_seat': 6400, 'mod_claims:standard:per_module': 210000, 'mod_claims:advanced:per_module': 290000, 'mod_claims:standard:per_usage': 300, 'mod_claims:advanced:per_usage': 450,
    'mod_legal:standard:per_seat': 5800, 'mod_legal:advanced:per_seat': 8400, 'mod_legal:standard:per_module': 260000, 'mod_legal:advanced:per_module': 380000, 'mod_legal:standard:per_usage': 900, 'mod_legal:advanced:per_usage': 1300,
    'mod_insights:standard:per_seat': 2800, 'mod_insights:advanced:per_seat': 4600, 'mod_insights:standard:per_module': 120000, 'mod_insights:advanced:per_module': 200000, 'mod_insights:standard:per_usage': 150, 'mod_insights:advanced:per_usage': 250,
    'mod_insights:standard:custom_vehicle': 90, 'mod_insights:advanced:custom_vehicle': 140,
    'mod_submit:standard:per_seat': 2200, 'mod_submit:standard:per_module': 90000, 'mod_submit:standard:per_usage': 400,
    'mod_core:standard:per_seat': 1500,
    'mod_portal:standard:flat': 25000, 'mod_portal:standard:per_usage': 40,
    'mod_ai:standard:flat': 30000, 'mod_ai:standard:per_usage': 20,
    'mod_pay:standard:flat': 15000, 'mod_pay:standard:per_usage': 75,
    'svc_migration:standard:flat': 250000, 'svc_config:standard:flat': 150000, 'svc_training:standard:flat': 60000,
  };
  const skus = [];
  const BASE = { type: 'standalone', status: 'published', discountBps: 0, chargeType: 'recurring', quantityRule: { type: 'per_module', min: 1, max: 500 } };
  const enabledKeys = (p) => p.metrics.filter((m) => m.enabled).map((m) => m.key);
  for (const p of products.filter((x) => x.kind === 'module')) for (const t of p.tiers) {
    skus.push({ ...BASE, id: `VDX-${p.code}-${t.id === 'standard' ? 'STD' : 'ADV'}`, name: `${p.name} ${t.name}`, audience: [...p.personas], licenseMetrics: enabledKeys(p), defaultMetric: 'per_seat',
      description: `${p.name} module, ${t.name} tier. Choose how it is licensed: ${enabledKeys(p).length} option${enabledKeys(p).length > 1 ? 's' : ''}.`, components: [{ productId: p.id, tierId: t.id }] });
  }
  const one = (productId) => [{ productId, tierId: 'standard' }];
  const prod = (id) => products.find((p) => p.id === id);
  skus.push(
    { ...BASE, id: 'VDX-CORE-USR', name: 'VeriDex Core user licence', audience: [...P], licenseMetrics: ['per_seat'], defaultMetric: 'per_seat', components: one('mod_core'), quantityRule: { type: 'per_module', min: 1, max: 2000 },
      description: 'Platform access. One licence per person who uses any module. Administrators who use no module need none.' },
    { ...BASE, id: 'VDX-ADD-PORTAL', name: 'Client Portal', audience: [...P], licenseMetrics: enabledKeys(prod('mod_portal')), defaultMetric: 'flat', components: one('mod_portal'), description: 'For the whole workspace, any number of insureds. Flat monthly fee or per active insured.' },
    { ...BASE, id: 'VDX-ADD-AI', name: 'AI Assistant', audience: [...P], licenseMetrics: enabledKeys(prod('mod_ai')), defaultMetric: 'flat', components: one('mod_ai'), description: 'For the whole workspace. Flat monthly fee or per document processed.' },
    { ...BASE, id: 'VDX-ADD-PAY', name: 'Digital Payments', audience: [...P], licenseMetrics: enabledKeys(prod('mod_pay')), defaultMetric: 'per_usage', components: one('mod_pay'), description: 'No monthly fee. Each successful payment after the included allowance is charged, billed monthly in arrears.' },
    { ...BASE, id: 'VDX-SVC-MIG', chargeType: 'one_time', name: 'Data migration', audience: [...P], licenseMetrics: ['flat'], defaultMetric: 'flat', components: one('svc_migration'), description: 'One-time fee per source system migrated.' },
    { ...BASE, id: 'VDX-SVC-CFG', chargeType: 'one_time', name: 'Initial configuration', audience: [...P], licenseMetrics: ['flat'], defaultMetric: 'flat', components: one('svc_config'), description: 'One-time fee for setting up your workspace with you.' },
    { ...BASE, id: 'VDX-SVC-TRN', chargeType: 'one_time', name: 'Private staff training', audience: [...P], licenseMetrics: ['flat'], defaultMetric: 'flat', components: one('svc_training'), description: 'One-time fee per live session.' },
  );
  // Bundles: "per_seat" = a seat count per module (each module keeps its own limit); "bundle_seat" = one shared pool of bundle seats,
  // where each person–module assignment uses one seat (a person in 3 modules of the bundle uses 3 seats).
  const bundle = (id, name, audience, description, comps, discountBps, bundleSeatPriceMinor) => ({ id, type: 'bundle', name, audience, description, status: 'published', chargeType: 'recurring',
    licenseMetrics: ['per_seat', 'bundle_seat'], defaultMetric: 'per_seat', bundleSeatPriceMinor, bundleSeatRule: { min: 2, max: 5000 },
    components: comps.map(([productId, tierId]) => ({ productId, tierId })), quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps });
  skus.push(
    bundle('VDX-BND-CL', 'Claims & Legal', [...P], 'Claims and Legal together. Choose seats per module, or one pool of bundle seats.', [['mod_claims', 'standard'], ['mod_legal', 'standard']], 1000, 4600),
    bundle('VDX-BND-SUITE', 'Complete Suite', [...P], 'All four modules at Standard tier. Seats per module, or one pool of bundle seats.', [['mod_policy', 'standard'], ['mod_claims', 'standard'], ['mod_legal', 'standard'], ['mod_insights', 'standard']], 1800, 3500),
    bundle('VDX-BND-CO', 'Carrier Operations', ['carrier'], 'Policy and Claims at Advanced tier for carrier operating teams.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced']], 1200, 5400),
    bundle('VDX-BND-CSUITE', 'Carrier Complete Suite', ['carrier'], 'All four modules at Advanced tier for multi-region carriers.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced'], ['mod_legal', 'advanced'], ['mod_insights', 'advanced']], 2000, 5200),
    { id: 'VDX-BND-TEAM5', type: 'bundle', name: 'Team Pack 5+5', audience: ['tenant'], status: 'published', chargeType: 'recurring', licenseMetrics: ['per_seat'], defaultMetric: 'per_seat',
      description: 'Fixed package: 5 Claims seats and 5 Legal seats per pack. Not customizable; add standalone seats if you need more of one module.',
      components: [{ productId: 'mod_claims', tierId: 'standard', fixedSeats: 5 }, { productId: 'mod_legal', tierId: 'standard', fixedSeats: 5 }],
      quantityRule: { type: 'fixed_package', min: 1, max: 50 }, discountBps: 0, packagePriceMinor: 42000 },
  );
  return { products, skus, prices, settings: { currency: 'USD', annualDiscountBps: 1000, taxBps: 825, smaBps: 1500, requirePlatformLicence: true } };
}
