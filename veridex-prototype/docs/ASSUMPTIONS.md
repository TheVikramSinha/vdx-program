# Assumptions, additions, deferred items, open questions

## Confirmed requirements honoured (from brief)
Brand logo and palette; licensing rules (§4); privacy boundary (no roster/workspace data before payment); separate carrier journey; bundles as first-class SKUs; onboarding only after payment.

## Demo assumptions (proposed, not confirmed commercial policy)
| Topic | Assumption |
| --- | --- |
| Catalog | 4 modules (Policy, Claims, Legal, Risk Insights), 2 tiers each. Names, features, prices invented. |
| Bundles | 5 illustrative bundles incl. one fixed pack. Compositions and discounts invented. |
| Bundle pricing | % discount on each module's unit price; unit rounded half-up to the cent, then × seats. |
| Discount stacking | Bundle discounts do not combine with each other; annual prepay (10%) applies after. |
| Bundle minimum | 1 seat per included module. |
| Currency / tax | USD only. Flat 8.25% "estimate". |
| Cadence | Monthly or annual prepaid; one cadence per order. |
| Proration | Added seats: days-left ÷ term-days × term price. Illustrative. |
| Seat reduction | Applies now, lower charge from next renewal, no refund. |
| Price changes | New versions affect new purchases and added seats only. Renewal repricing undecided. |
| Invitations | 7-day expiry; expired holds seat until resent/revoked. |
| Suspended users | Keep seats. |
| Tier change / cancel | Request to VeriDex (lead), not self-service. |
| Admin prefill | Receipt contact prefilled as administrator, editable. |
| Platform roles | Platform admin, Catalog manager, Pricing approver, Support read-only. |

## Additions beyond the brief
"Seats needed" comparison tool (standalone vs every bundle, seats beyond need); tier comparison table; saved quote download; receipt download; CSV roster import with row validation; platform quote preview on draft catalog; scheduled publish with "go live now"; catalog version history; billing-event log; plan-change request; expired-invitation and full-module alerts; deterministic demo scenarios; DOM-morph rendering to keep focus.

## Deferred / simulated
Real payment, tax, invoices, refunds, dunning; identity and SSO; email delivery; live chat; CRM; server authorization; multi-currency price books (structure allows it, UI shows USD); customer-specific price books; multiple workspaces per customer; self-service tier upgrade; renewal job; automatic invitation expiry by clock (demo uses a "Simulate expiry" action); localisation.

## Open questions for VeriDex
1. Vector logo and usage rules (PDF is raster only).
2. Which lock-up is primary in product UI: "SOLUTION.AI" or the tagline version? (Header uses SOLUTION.AI, footer uses tagline.)
3. Real module list, tiers, prices, bundle compositions.
4. Bundle minimums per module; are fixed packs wanted at all?
5. Renewal repricing and notice period for existing customers.
6. Refund/credit policy on seat reduction and cancellation.
7. Expired-invitation auto-release period; suspended-user seat policy.
8. Carrier-specific commercial terms (enterprise quote vs self-service).
