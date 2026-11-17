// Synthetic leads for the staff inbox demo. No real people or companies.
export const SEED_LEADS = [
  { source: 'intake', persona: 'tenant', orgType: 'MGA / program administrator', size: '11–50', interests: ['Claims', 'Legal'], goals: 'Replace spreadsheets for litigation tracking.', timing: 'This quarter', email: 'ops.lead@harborline.example.test', followUp: 'demo', consent: true, synthetic: true },
  { source: 'chat', persona: 'carrier', orgType: 'Excess & surplus carrier', size: '100–500', interests: ['Carrier Operations'], goals: 'Phased rollout across two regions.', timing: 'Next 6 months', email: 'transformation@keystonemutual.example.test', followUp: 'call', consent: true, synthetic: true },
  { source: 'chat-offline', persona: 'tenant', orgType: 'Not sure', size: 'Not sure', interests: [], goals: 'Asked about seat rules while specialists were offline.', timing: 'Not sure', email: 'buyer@oakfield.example.test', followUp: 'email', consent: true, synthetic: true },
];
