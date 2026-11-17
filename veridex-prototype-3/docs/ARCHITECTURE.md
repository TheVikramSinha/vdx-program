# Architecture and data model

Designed from the brief's business behaviour. No earlier ERD was supplied or used.

## Layers
```
views/templates/   pure functions: state → escaped HTML string
controllers/       events → model calls → save → re-render (DOM morph keeps focus)
models/            rules + state transitions, no DOM, no storage (run in Node tests)
services/          adapters: storage, paymentMock, identityMock, invitationMock, chatMock, crmMock, scenarios
data/              seed catalog, persona config, sample CSV, sample leads
```
Rules live only in models. UI disables what the model would refuse; the model refuses anyway (e.g. `CapacityError`).

## Three bounded contexts → three storage aggregates
| Aggregate | Key | Owner | Holds |
| --- | --- | --- | --- |
| **Platform** | `vdx.demo.platform` | VeriDex | catalog (draft, published, version history, schedule), orders, billing events, leads, audit, current platform role |
| **Workspace** ×2 | `vdx.demo.ws.tenant`, `…ws.carrier` | Customer | entitlements, subscription lines, members, seat assignments, onboarding, activity |
| **Draft** ×2 | `vdx.demo.draft.tenant`, `…draft.carrier` | Anonymous buyer | cart, checkout session, receipt contact, review confirmations, saved quotes, intake draft, chat |

Tenant and carrier never share a workspace or draft. Platform never stores member rosters; workspaces never store catalog.

## Model (entities and relationships)
```
COMMERCIAL OFFER (platform)                 PURCHASE (platform)              ACCESS (workspace)
Product 1─* Tier                            Order 1─* OrderLine              Entitlement (per module: tier, purchased, enabled, visible)
   └ PriceBook: (product,tier) → unit price    OrderLine = SKU snapshot          ▲ created/increased by OrderLine components
SKU 1─* Component(product, tier, fixedSeats?)    1─* LineComponent(module,     SubscriptionLine (SKU id, catalog version, components, cadence, renewal)
   quantityRule {per_module | fixed_package}        tier, seats, unit prices)  Member (stable id; name, email, type, isAdmin, status, invite)
   discountBps | packagePrice                 BillingEvent (attempt results)   Assignment (member, module, role) = exactly one seat
   audience [tenant|carrier], status          CheckoutSession (idempotency)    Activity
Catalog version = immutable snapshot of all of the above
```
Key separations:
- **Offer ≠ purchase ≠ access.** SKU (what is sold) → OrderLine (what was bought, with its own price copy) → Entitlement (capacity per module) → Assignment (who uses a seat).
- **Bundle identity survives**: OrderLine and SubscriptionLine keep `skuId`, `skuType`, `catalogVersion`; entitlements are per module.
- **Member id is the identity key**, never the email. Email edits keep assignments and roles.
- **Admin is a flag**, not a seat. `isAdmin` creates no Assignment.

## v3 additions
- **SKU**: `licenseMetric` (per_user, per_module, flat, usage), `chargeType` (recurring, one_time), `usage` {unitLabel, includedUnits}, quantity rule types `per_module`, `fixed_package`, `flat`, `usage`.
- **Product**: `kind` (module, platform, addon, service). `METRIC_KINDS` maps which metric may sell which kind.
- **Settings**: `smaBps`, `requirePlatformLicence`.
- **Order**: `smaBps`, `smaMonthlyMinor`, `oneTimeMinor`, `usageTerms`; lines carry `licenseMetric`, `chargeType`, `units`, `usage`.
- **Entitlement**: `licenseMetric`; `purchased` is null for workspace-wide add-ons; `usage` {rate, included, used}.
- **Workspace**: `services[]` for one-time delivery (not entitlements).
- **Cart session** (platform, `models/cartSessions.js`): buyer contact + follow-up consent, cart snapshot, stage, last activity, follow-up status/owner/notes, timeline. Status derived: converted / active / abandoned (threshold in `platform.cartSettings`).

## Rules and where they are enforced
| Rule | Code |
| --- | --- |
| Seats per module; no pooling | `licensing.capacity`, `licensing.assign` |
| reserved + assigned + available = purchased | `licensing.capacity` (one Assignment record, state from member status) |
| Admin free | `onboarding.saveOrg`, `licensing.setAdmin` |
| One user licence per person with any module seat | `licensing.capacity` (per_user), `licensing.assign`, `parseCsv` |
| Module seats need user licences (setting) | `pricing.quote` errors with held context |
| Workspace-wide add-on bought once | `pricing.quote`, `orders.applyOrder` |
| SMA only on recurring licence fees; one-time not discounted or renewed | `pricing.quote` |
| Contact before products | `controllers/storefront.js` route guard + `cartSessions.hasContact` |
| No contact without permission | `cartSessions.updateFollowUp` |
| No over-allocation | `licensing.assign` throws `CapacityError`; UI disables |
| Purchase before provisioning | `onboarding.canEnter` / `goTo` / `saveOrg` require `unlocked`, set only by `orders.recordPayment` on approval |
| One order per checkout | `orders.openCheckout` (session id = idempotency key), `recordPayment` returns existing order |
| Capacity only after payment | `orders.completeAddSeats` |
| Reduction is explicit, never below occupied | `orders.reduceSeats` |
| Tier conflict blocked | `pricing.quote().conflicts`, `orders.applyOrder` |
| Money in integer cents, half-up rounding | `models/money.js` |
| Publish = new immutable version; orders keep snapshot | `platform.publish`, order `lines` |
| Platform permissions | `platform.can` / role map; every mutation checks |
| Checklist gates, stale on edit | `models/checklist.js` (confirmation = hash of covered data) |

## Seat state policy (demo; proposed for production)
| Member status | Seat effect |
| --- | --- |
| Not invited (draft) | reserves |
| Invitation pending | reserves (same record) |
| Active | assigned (same record — no double count) |
| Invitation expired | keeps reservation until resent or revoked. Proposed: auto-release 14 days after expiry |
| Suspended | keeps seat, cannot sign in. Free it by removing module access |
| Revoked | all seats released to their own modules; billing unchanged |

## Catalog lifecycle
Draft (editable) → validate → diff vs live → preview quote → publish (now or scheduled) → new version. Retire = status change published in the next version. Existing subscriptions unaffected. Open carts are re-quoted on the live catalog; a changed total invalidates the checkout session and the review confirmation.

## State handling
- Schema version in every stored record; mismatched/corrupt data is set aside under `…​.incompatible` and the user is told. No silent migration.
- Export/import: one JSON with schema; import validates shape before writing anything.
- Deterministic scenarios (`services/scenarios.js`) built through public model functions with a fixed clock.
- All user text rendered through an escaping template tag.

## Production integration boundaries (not done here)
| Area | Demo | Production needs |
| --- | --- | --- |
| Storage / authz | localStorage, role switch in UI | Server database, tenant isolation, server-side authorization on every call |
| Payment | `paymentMock` named outcomes | PSP hosted fields/redirect, server-side verification, signed webhooks, idempotency keys stored server-side, tax service |
| Entitlements | written by browser model | Created only by server from verified payment events; enforced at API and module level |
| Identity | none; "simulated sign-in" | IdP (OIDC/SAML), verified email, MFA, sessions, SCIM optional |
| Invitations | status flips | Email service, signed expiring tokens, expiry job |
| Chat / CRM | scripted replies, local leads | Chat vendor, CRM API, consent log with timestamp and policy version |
| Billing ops | illustrative proration, no refunds | Billing engine: proration, renewals, dunning, credit notes, invoices |
| Audit | local lists | Append-only server audit trail |
Browser storage is not a security boundary. Nothing in the demo is a verified identity, payment or entitlement record.
