// Checklist shown at order review. Confirmations are bound to the cart, so editing the order clears them.
import { evaluate, gate, setConfirmation } from './checklist.js';
import { hash } from './ids.js';
export const cartKey = (draft) => hash([draft.cart.lines, draft.cart.cadence]);
const DEFS = [
  { id: 'order-reviewed', kind: 'confirm', required: true, label: 'I have reviewed the SKUs, seat counts per module, billing cadence and amount due', hint: 'Changing the order clears this confirmation.', covers: (d) => [d.cart.lines, d.cart.cadence] },
  { id: 'per-module', kind: 'confirm', required: true, label: 'I understand seats belong to one module each and are not shared between modules', covers: (d) => d.cart.lines.map((l) => l.skuId) },
  { id: 'quote-saved', kind: 'auto', required: false, label: 'A copy of this quote is saved', hint: 'Use “Save quote”. You can skip this.', check: (d) => d.savedQuotes.some((q) => q.key === cartKey(d)) },
];
export const reviewChecklist = (draft) => evaluate(DEFS, draft, draft.confirmations);
export const reviewGate = (draft) => gate(reviewChecklist(draft));
export const confirmReview = (draft, id, on) => setConfirmation(DEFS, draft, draft.confirmations, id, on);
