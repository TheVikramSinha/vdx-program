// Mock chat adapter: scripted assistant replies and a simulated specialist handoff. No vendor, no network.
export const TOPICS = [
  { id: 'seats', label: 'How seats work' },
  { id: 'bundles', label: 'Bundles vs individual modules' },
  { id: 'billing', label: 'Billing and renewals' },
  { id: 'onboarding', label: 'What happens after purchase' },
  { id: 'human', label: 'Talk to a specialist' },
];
const ANSWERS = {
  seats: 'Each module has its own seats. A person who uses two modules holds one seat in each. Bundles can instead use shared bundle seats: each person–module assignment uses one seat from the pool. The workspace administrator role is free and holds no seat unless you assign one.',
  bundles: 'A bundle is one SKU covering several modules. In configurable bundles you still choose a seat count per module, and each module keeps its own limit. Fixed packs include set seats per pack; any seats beyond your need are shown before you pay.',
  billing: 'Prices here are illustrative. Monthly bills each month; annual is prepaid with a discount. Freeing a seat never lowers your bill on its own — reducing purchased seats is a separate, confirmed change.',
  onboarding: 'After payment you name your workspace, nominate a free administrator, add people, allocate seats per module and send invitations. We never ask for names or emails of your team before purchase.',
};
export function reply(text) {
  const t = text.toLowerCase();
  const key = /seat|licen|user|admin/.test(t) ? 'seats' : /bundle|suite|pack|module/.test(t) ? 'bundles' : /price|bill|renew|annual|month|cost|tax/.test(t) ? 'billing' : /onboard|invite|after|setup|set up/.test(t) ? 'onboarding' : /human|person|specialist|agent|call|demo/.test(t) ? 'human' : null;
  if (key === 'human') return { handoff: true };
  return { text: key ? ANSWERS[key] : 'I can explain seats, bundles, billing or onboarding. For anything else, ask for a specialist and we will take a follow-up request.' };
}
export const answerFor = (id) => ANSWERS[id];
