# Demo walkthrough

Start: **Demo tools → Fresh start**.

## A. Tenant: buy, fail, retry, succeed (5 min)
1. `index.html` → **Product bundles** → *Try the 10 Claims + 4 Legal example*.
   Table shows: Individual $652.00 · Claims & Legal $586.80 (lowest) · Complete Suite (2 seats beyond need) · Team Pack 5+5 $840.00 (6 paid, not needed).
2. **Use this** on Claims & Legal. Order panel shows SKU `VDX-BND-CL`, capacity 10 Claims + 4 Legal.
3. Optional: Individual modules → Claims → Advanced → Add. Conflict alert blocks checkout. Remove it.
4. **Review order** → try *Continue* → blocked by checklist. Tick two required items. *Save quote* is optional.
5. Checkout: receipt contact only. Choose *issuer declines* → pay → declined. Choose *cancels* → cancelled. Choose *approves* → confirmation. One order only.
6. **Start onboarding**.

## B. Onboarding (4 min)
1. Workspace: admin prefilled from receipt, editable. Admin is free, no seat. Tick the required confirmation.
2. People: add people; tick seats per module; fill Legal to 4 → fifth Legal box disabled ("Full") while Claims has room. Try *Import sample CSV*.
3. Invitations: *Send* (simulated) or *Defer*. Use *Simulate accept* / *Simulate expiry*.
4. Readiness: sign-in preference; hide/disable a module (capacity unchanged).
5. Finish → **Open Tenant Admin**.

## C. Tenant Admin (3 min)
- Overview: purchased / assigned / reserved / available per module; free admin role.
- People: search, filter, *Manage* (edit email — id stays; toggle module seats; suspend; revoke).
- Plan & billing: *Buy seats* (price preview, proration, simulated payment — try decline first); *Reduce seats* (blocked below occupied); *Request a plan change*.
- Activity log.

## D. VeriDex Admin → storefront → tenant (5 min)
1. `veridex-admin.html` → Products → **New product** (e.g. Subrogation).
2. Review & publish: validation error "Missing unit price"; Publish disabled.
3. Pricing: set Subrogation price; change Claims Standard to 45.00.
4. SKUs → **New bundle SKU**: `VDX-BND-CSUB`, Claims + Subrogation, 15%.
5. Shop still shows old catalog (draft is not live).
6. Switch role to *Catalog manager* → cannot publish. Switch to *Pricing approver* → **Publish catalog…** → confirm.
7. Shop → Product bundles → new bundle appears with new prices.
8. Tenant Admin → Plan & billing: existing line still `@ $37.80`, catalog v1. Not rewritten.
9. Quote preview: 10 + 4 worked example on the draft. Customers, Orders & billing, Roles & audit.

## E. Carrier (3 min)
`carrier.html`: own hero, carrier bundles (Carrier Operations, Carrier Complete Suite), empty cart even though tenant bought. `onboarding.html?p=carrier` is locked until the carrier purchase. Onboarding adds lines of business, operating regions, rollout approach.

## F. Assistance, chat, leads (3 min)
- `assistance.html` → fill → review → record → download brief. Cart untouched.
- Chat button (any sales/onboarding page): topics, typed question, set *specialists: Offline*, *Talk to a specialist* → follow-up form needs email + permission.
- `demo-leads.html`: source, persona, interest, status, owner, notes.

Shortcut: **Demo tools → Tenant and carrier fully onboarded**.
