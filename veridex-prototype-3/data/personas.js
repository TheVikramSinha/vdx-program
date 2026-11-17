// Persona configuration: drives distinct tenant and carrier journeys (copy, intake options, onboarding fields).
export const PERSONAS = {
  tenant: {
    id: 'tenant', label: 'Agency / MGA / TPA', short: 'Tenant', home: 'index.html', accent: 'teal',
    hero: { title: 'Run claims, legal and policy work from one workspace.', lead: 'Buy only the modules your teams use. Each module has its own seats. Add people after purchase.' },
    orgTypes: ['Insurance agency', 'MGA / program administrator', 'Third-party administrator', 'Law firm / panel counsel', 'Not sure'],
    sizes: ['1–10', '11–50', '51–200', '200+', 'Not sure'],
    goals: ['Replace spreadsheets', 'Consolidate vendors', 'Faster claim handling', 'Better litigation oversight', 'Not sure yet'],
    businessTypes: ['Insurance agency', 'MGA / program administrator', 'Third-party administrator', 'Law firm', 'Other'],
    featured: 'VDX-BND-CL',
    proof: ['Seats are per module — never pooled', 'Workspace administrator is free', 'Names and emails only after purchase'],
  },
  carrier: {
    id: 'carrier', label: 'Insurance carrier', short: 'Carrier', home: 'carrier.html', accent: 'steel',
    hero: { title: 'Carrier operations across lines, regions and teams.', lead: 'Advanced-tier bundles for policy and claims operations, with phased regional rollout planned after purchase.' },
    orgTypes: ['Admitted carrier', 'Excess & surplus carrier', 'Captive / risk retention group', 'Reinsurer', 'Not sure'],
    sizes: ['Under 100 staff', '100–500', '500–2,000', '2,000+', 'Not sure'],
    goals: ['Modernize policy administration', 'Claims operating model change', 'Litigation spend control', 'Regional expansion', 'Not sure yet'],
    businessTypes: ['Admitted carrier', 'E&S carrier', 'Captive / RRG', 'Reinsurer'],
    regions: ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West'],
    lines: ['Commercial auto', 'Trucking / fleet', 'General liability', 'Property', 'Workers compensation'],
    featured: 'VDX-BND-CO',
    proof: ['Advanced-tier carrier bundles', 'Per-module seats by operating team', 'Regional rollout planning after purchase'],
  },
};
export const personaOf = (id) => PERSONAS[id] || PERSONAS.tenant;
