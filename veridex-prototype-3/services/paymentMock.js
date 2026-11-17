// Mock payment adapter. Replace with a real PSP client + server-side verification and webhooks in production.
// No card data is ever collected: the "method" is a named test outcome.
export const METHODS = {
  approve: { label: 'Demo method — payment approves', status: 'approved' },
  decline: { label: 'Demo method — issuer declines', status: 'declined', message: 'The simulated issuer declined this payment. Nothing was charged.' },
  cancel: { label: 'Demo method — buyer cancels at bank step', status: 'cancelled', message: 'You cancelled at the simulated bank step. Nothing was charged.' },
};
const approved = new Map(); // idempotencyKey → result
let n = 0;
export async function authorize({ method, amountMinor, currency, idempotencyKey, delay = 500 }) {
  if (approved.has(idempotencyKey)) return approved.get(idempotencyKey);
  await new Promise((r) => setTimeout(r, delay));
  const m = METHODS[method] || METHODS.decline;
  const result = { status: m.status, message: m.message || '', ref: `SIM-${m.status.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${++n}`, amountMinor, currency, simulated: true };
  if (m.status === 'approved') approved.set(idempotencyKey, result);
  return result;
}
