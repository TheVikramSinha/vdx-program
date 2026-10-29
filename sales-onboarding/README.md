# VeriDex sales and onboarding MVC prototype

A local, dependency-free prototype with separate purchasing and post-purchase setup experiences for tenants and carriers.

## Run

Run `npm start` in this folder and open http://127.0.0.1:8767/index.html. The existing parent server also serves http://127.0.0.1:8766/onboarding-mvc/index.html. Use HTTP because JavaScript modules and HTML templates load separately. Run `npm test` for the model tests.

## Entry points

- `index.html`: tenant sales — products/bundles, quantities, review/payment, receipt.
- `onboarding.html`: tenant setup — workspace/owner, module users, invitations, configuration, success.
- `carrier-sales.html`: isolated carrier sales, with carrier bundles.
- `carrier-onboarding.html`: isolated carrier setup, with operational readiness.
- `carrier.html`: compatibility redirect to carrier sales.
- `assistance.html`: optional guidance brief based on indicative requirements.

## MVC structure

`app.js` composes the persona, experience, injected session store, model, view, and controller. Models own pricing, validation, seat limits, payment snapshots, and transition guards. Controllers handle events and navigation. Views render escaped data into separate HTML templates under `views/templates/`. Styling lives in `assets/css/`; storage, template loading, and UI utilities live in `services/`.

`CarrierModel` extends the shared business engine with its own persona, bundles, state namespace, and readiness rules. Carrier controllers likewise reuse interaction handling without sharing tenant state. Assistance has a separate model, controller, view, and storage.

## Purchase and setup rules

- Sales collects counts only per module. Bundles apply a common count to included modules and allow independent overrides. Every selected module requires 1–1,000 seats. No individual user name, email, or role is requested before purchase. Checkout requests only a receipt/setup contact email and preview consent.
- Two required purchase confirmations verify scope and quantities. Quantity or package changes invalidate relevant confirmations.
- Successful simulated payment freezes a quantity-and-price order snapshot. A receipt provides an explicit Start onboarding handoff. Failed/cancelled payments leave setup locked; direct route changes and model calls cannot bypass the normal payment gate.
- Workspace naming and owner details are collected after payment. Provisioning assigns names, emails, and roles within each module’s purchased limit. The same person can have access to several modules, consuming one seat in each. Duplicate emails within a module are rejected.
- Unassigned licenses stay paid and available. Admins can defer allocation by acknowledging capacity and access checks. Setup never silently changes purchased quantities or prices.
- Required checklist confirmations gate workspace save, team review, and finalization. Editing related details invalidates confirmations. Recommended invitation/notification actions may be deferred.
- Invitations are deduplicated by email while preserving module roles. Sending is simulated; deferral does not claim delivery.
- Carrier setup adds operating region, rollout approach, and a required identity/readiness review. Both personas have sequential progress indicators and completion screens.
- Role-based profiles set defaults for landing view, digest, and future users; they do not overwrite existing user permissions.
- Product tiers and prices retain the original wireframe assumptions. Monthly prices use `round(annualUnit × 1.2)`; totals use integer cents. Multiple-module discounts are 10/15/20% for 2/3/4 modules. Annual billing is 12 discounted monthly equivalents, USD, excluding taxes. Bundles are illustrative catalog configurations.
- Guidance collects a reply email and indicative organizational requirements, not a roster. It creates a local downloadable brief without sending a request.

## Storage and production boundaries

State is tab-scoped session storage: `vdx:mvc:tenant:v3`, `vdx:mvc:carrier:v3`, and `vdx:mvc:assistance:v2`. Reload resumes progress. Start over clears only the current persona/flow. Previous v2 purchase drafts are deliberately not migrated because they contained pre-purchase user assignments.

This is an interaction prototype. Payment, email, provisioning, identity configuration, and external submissions are simulated. Browser state is editable and does not provide production authorization. Production integration requires authenticated order ownership, server-enforced seat and role entitlements, verified/idempotent payment webhooks, address reservation, invitation delivery/acceptance, audit records, and appropriate data retention.

## Verification

20 Node tests cover counts-only purchasing, integer-cent pricing, bundle quantities, invalid counts, checklist invalidation, payment failures and gates, immutable orders, workspace validation, per-module capacity, duplicate users, reserved seats, role changes, invitation deduplication, finalization checks, carrier readiness, persona isolation, and v3 recovery.

Browser checks completed tenant and carrier purchases and onboarding, including failed payment/retry, receipt handoff, post-payment user details, unused seats, required checkbox gating, and optional recommendations. Evidence is under `tests/artifacts/`. The existing responsive fixture is available at `tests/responsive.html`.

The prior standalone source is preserved at `../onboarding-redesign/legacy-standalone.html`; the root legacy entry redirects to the MVC project.


## Identity / tenant ERD alignment — 2026-10-29

Updated the local prototype against the supplied `01a_identity_tenant.svg` (retained under `onboarding-mvc/reference/` in the workspace). The new identity model separates sign-in organization, business workspace, legal-entity intent, tenant membership, and module assignment intent. Post-payment setup now collects organization name, optional legal name, business type, data-region preference, and shared/dedicated isolation preference. Carrier onboarding fixes business type to carrier; standard onboarding covers the other five types.

Memberships now have stable UUIDs. Explicit reuse shares a membership across modules; email is only contact data. Shared contact and membership-type changes propagate, while per-module role preferences remain independent. Separate same-email drafts require review rather than being silently merged. Invitations use membership IDs and remain pending until verified sign-in. The nominated owner is not inferred to be an authenticated identity from the receipt email.

Purchased module visibility and enablement are separate controls, preserving billing and seat capacity. Changing them invalidates readiness. Completion offers an ERD-oriented setup-intent JSON export with unresolved server IDs clearly null and no fabricated external identities, legal consents, or subscription projections. See `reference/erd-alignment.md` inside the MVC folder for the mapping and deliberate boundaries.

Existing v3 drafts retain payment and seats. Older drafts without identity metadata return to workspace review and receive independent pending membership IDs; their contact emails are not used to merge identities. Storage remains v3, with asset cache version 4.0. 26 automated tests pass. Browser verification covered purchase → organization setup → partner membership → invitations → module visibility and readiness invalidation → completion.


## Independent module seats and help demo — 2026-10-29

User clarified that licenses are never pooled across modules: workspace administration alone consumes zero seats, while each module maintains its own fixed capacity. Reusing a tenant membership across modules does not share a license. A workspace administrator who also uses a product requires a seat in that product. Added explicit UI copy and a regression test proving unused Claims capacity cannot cover a full Legal module.

User confirmed no live-chat service is needed: this is a complete local demonstration. Added a persistent Chat with us launcher on sales, onboarding, and intake pages; topic guidance, typed messages, a simulated specialist handoff, request-specific follow-up permission, and downloadable lead/transcript. All replies and lead handling are explicitly simulated. Context includes only journey stage and selected module names, not workspace details or rosters. Separate tenant/carrier chat stores use `vdx:chat:{persona}:v1`. Closing the chat preserves it; Clear demo chat resets it. Lead form drafts survive topic changes.

Guidance intake now supports dedicated carrier context and separate tenant/carrier storage at `vdx:mvc:assistance:{persona}:v2`. It collects indicative needs, product interests, timing, reply email, and contact permission without provisioning users. Carrier return links stay in carrier sales. Prior generic assistance storage is retained but is not imported into the new persona-specific drafts.

32 tests pass, including free administration, independent module limits, chat permission and context boundaries, and carrier intake. Browser checks verified the handoff/lead confirmation and carrier intake submission. No real agents, CRM records, messages, payments, or bookings are created.

Suggested future demo scope (not yet implemented): a per-module capacity dashboard, invitation expiry/resend/revocation, an explicit add-seat purchase flow, and an administration activity log.
