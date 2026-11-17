// Illustrative demo catalog. Names, compositions and prices are DEMO ASSUMPTIONS, not confirmed VeriDex offers.
const P = ['tenant', 'carrier'];
const tiers = (std, adv) => [
  { id: 'standard', name: 'Standard', features: std },
  { id: 'advanced', name: 'Advanced', features: adv },
];
export const ROLES = ['Viewer', 'Contributor', 'Manager'];
export function seedCatalog() {
  const products = [
    { id: 'mod_policy', code: 'POL', name: 'Policy', summary: 'Quote, bind and service policies.', description: 'Policy lifecycle workspace: submissions, quoting, endorsements and renewals.', personas: P, status: 'active',
      tiers: tiers(['Submission intake', 'Quote & bind', 'Renewal queue'], ['Everything in Standard', 'Rules-based underwriting referrals', 'Bulk endorsements']) },
    { id: 'mod_claims', code: 'CLM', name: 'Claims', summary: 'Intake to settlement in one file.', description: 'Claims workspace: first notice of loss, reserves, payments and recovery.', personas: P, status: 'active',
      tiers: tiers(['FNOL intake', 'Claim file & diary', 'Payment requests'], ['Everything in Standard', 'Reserve authority workflows', 'Subrogation tracking']) },
    { id: 'mod_legal', code: 'LGL', name: 'Legal', summary: 'Matters, counsel and litigation spend.', description: 'Legal workspace: matter management, panel counsel and litigation budgets.', personas: P, status: 'active',
      tiers: tiers(['Matter register', 'Counsel assignment', 'Document holds'], ['Everything in Standard', 'Litigation budgets', 'Outcome analytics']) },
    { id: 'mod_insights', code: 'INS', name: 'Risk Insights', summary: 'Portfolio and telematics signals.', description: 'Analytics workspace: loss ratios, exposure views and telematics risk signals.', personas: P, status: 'active',
      tiers: tiers(['Standard dashboards', 'Scheduled exports'], ['Everything in Standard', 'Custom measures', 'Telematics risk scoring']) },
  ];
  const prices = {
    'mod_policy:standard': 3600, 'mod_policy:advanced': 5400,
    'mod_claims:standard': 4200, 'mod_claims:advanced': 6400,
    'mod_legal:standard': 5800, 'mod_legal:advanced': 8400,
    'mod_insights:standard': 2800, 'mod_insights:advanced': 4600,
  };
  const skus = [];
  for (const p of products) for (const t of p.tiers) {
    skus.push({ id: `VDX-${p.code}-${t.id === 'standard' ? 'STD' : 'ADV'}`, type: 'standalone', name: `${p.name} ${t.name}`, audience: [...P],
      description: `${p.name} module, ${t.name} tier, priced per seat.`, status: 'published',
      components: [{ productId: p.id, tierId: t.id }], quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps: 0 });
  }
  const bundle = (id, name, audience, description, comps, discountBps) => ({ id, type: 'bundle', name, audience, description, status: 'published',
    components: comps.map(([productId, tierId]) => ({ productId, tierId })), quantityRule: { type: 'per_module', min: 1, max: 500 }, discountBps });
  skus.push(
    bundle('VDX-BND-CL', 'Claims & Legal', [...P], 'Claims and Legal together. Choose a seat count for each module.', [['mod_claims', 'standard'], ['mod_legal', 'standard']], 1000),
    bundle('VDX-BND-SUITE', 'Complete Suite', [...P], 'All four modules at Standard tier. A separate seat count per module.', [['mod_policy', 'standard'], ['mod_claims', 'standard'], ['mod_legal', 'standard'], ['mod_insights', 'standard']], 1800),
    bundle('VDX-BND-CO', 'Carrier Operations', ['carrier'], 'Policy and Claims at Advanced tier for carrier operating teams.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced']], 1200),
    bundle('VDX-BND-CSUITE', 'Carrier Complete Suite', ['carrier'], 'All four modules at Advanced tier for multi-region carriers.', [['mod_policy', 'advanced'], ['mod_claims', 'advanced'], ['mod_legal', 'advanced'], ['mod_insights', 'advanced']], 2000),
    { id: 'VDX-BND-TEAM5', type: 'bundle', name: 'Team Pack 5+5', audience: ['tenant'], status: 'published',
      description: 'Fixed package: 5 Claims seats and 5 Legal seats per pack. Not customizable; add standalone seats if you need more of one module.',
      components: [{ productId: 'mod_claims', tierId: 'standard', fixedSeats: 5 }, { productId: 'mod_legal', tierId: 'standard', fixedSeats: 5 }],
      quantityRule: { type: 'fixed_package', min: 1, max: 50 }, discountBps: 0, packagePriceMinor: 42000 },
  );
  return { products, skus, prices, settings: { currency: 'USD', annualDiscountBps: 1000, taxBps: 825 } };
}
