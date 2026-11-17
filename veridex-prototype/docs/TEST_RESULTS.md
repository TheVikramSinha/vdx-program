# Test results — 17 Nov 2026 (after UI refresh v2)

## Model tests — `node tests/run.mjs`
```
✔ [1] Admin-only setup consumes zero module seats
✔ [2] One person in two modules uses two seats; no cross-module borrowing
✔ [3] Bundle purchase keeps SKU identity and expands to module entitlements
✔ [4] Mixed cart: overlap, quantities, cadence, rounding, invalid input
✔ [5] No roster/workspace details before payment; direct onboarding entry fails
✔ [6] Declined / cancelled / retried payment never duplicates entitlements
✔ [7] Allocation cannot exceed capacity; reservations are not double-counted
✔ [8] Contact edits keep stable identity and independent module roles
✔ [9] Required checklist items gate, invalidate on edit; optional do not block
✔ [10] Tenant and carrier drafts, workspaces and lead contexts stay isolated
✔ [11] Invitation accept / expire / resend / revoke and seat release
✔ [12] More seats need an explicit paid step; removing access never changes billing
✔ [13] Module visibility / enablement never changes purchased capacity
✔ [14] Leads need contact permission and never claim delivery or bookings
✔ [15] Reload, reset, export and import validation
✔ [17] VeriDex Admin: create product, prices, bundle SKU, publish → purchaser sees it
✔ [18] Unequal demand 10 + 4: standalone vs bundle totals and capacity
✔ [19] Tenant capacity matches the order; later price edits do not rewrite it
✔ [20] Platform and tenant scopes are distinct
✔ [S] Demo scenarios build deterministically and respect every capacity rule
✔ [C] Generic checklist engine: stale confirmations

21/21 passed
```
Criterion 16 (logo/palette) is verified by inspection: see `BRAND_TOKENS.md` and screenshots.

## Browser walk-through — `python3 tests/ui_e2e.py` (Chromium, 1360×900 and 390×844)
```
✔ Direct onboarding link is locked before payment
✔ Tenant Admin empty state
✔ 10 + 4 comparison: $652.00 standalone, $586.80 bundle, fixed pack discloses 6 unneeded seats
✔ Tier overlap is blocked with an explicit choice
✔ Invalid quantity rejected
✔ Required checklist gates checkout
✔ Editing the order clears the confirmation
✔ No card fields or roster fields at checkout
✔ tenant: invalid receipt email blocked with error summary
✔ tenant: declined and cancelled states, order kept
✔ Decline → cancel → approve produced exactly one order
✔ Onboarding step 1 validation with summary
✔ Admin-only setup uses 0 seats; capacity is 10 Claims / 4 Legal
✔ Fifth Legal assignment blocked at 4/4 while Claims has spare seats
✔ Changing seats clears the allocation confirmation
✔ Invitation decision is required
✔ Accept converts a reservation to assigned; expiry keeps reservation; no double count
✔ Tenant onboarding completed
✔ Declined seat purchase leaves capacity unchanged
✔ Paid seat purchase adds Legal capacity only
✔ Email edit keeps member id, seats and roles
✔ Revoking releases seats without changing purchased capacity
✔ Publish blocked by validation error (missing price)
✔ Draft SKU is not visible to buyers before publish
✔ Catalog manager cannot publish (role separation)
✔ Published price change did not rewrite the existing subscription
✔ Published bundle appears in the purchaser journey
✔ Carrier cart is isolated from the tenant journey
✔ Carrier onboarding locked although the tenant has purchased
✔ carrier: invalid receipt email blocked with error summary
✔ Carrier readiness requires an operating region
✔ Carrier journey verified from purchase through administration
✔ Intake requires email and contact permission
✔ Intake confirmation states request only, nothing sent or booked
✔ Chat: scripted answer, offline state, follow-up needs permission
✔ Chat draft survives reload
✔ Keyboard: skip link first, dialog closes on Esc and restores focus
✔ Mobile: no horizontal overflow, menu works
✔ Demo scenario loads
✔ Reset demo returns every area to a clean first-run state
✔ No console or page errors

41 UI checks passed
```

## Acceptance criteria map
| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Admin-only = 0 seats | model [1]; UI "Admin-only setup uses 0 seats" |
| 2 | Two modules = two seats, no borrowing | model [2]; UI "Fifth Legal assignment blocked…" |
| 3 | Bundle keeps SKU, expands entitlements | model [3]; receipt, Plan & billing |
| 4 | Mixed cart, cadence, rounding, invalid input | model [4]; UI tier conflict, invalid quantity |
| 5 | No roster pre-payment; bypass fails | model [5]; UI locked onboarding, no card/roster fields |
| 6 | Decline/cancel/retry, no duplicates | model [6]; UI "exactly one order" |
| 7 | Capacity cap, no double count | model [7]; UI accept/expire counts |
| 8 | Contact edit keeps identity and roles | model [8]; UI email edit |
| 9 | Checklist gates and invalidates | model [9], [C]; UI checkout + onboarding |
| 10 | Tenant/carrier isolation | model [10]; UI carrier cart + locked onboarding |
| 11 | Invitation lifecycle and release | model [11]; UI revoke |
| 12 | Explicit seat purchase; removal ≠ billing | model [12]; UI buy seats declined/approved |
| 13 | Visibility ≠ capacity | model [13] |
| 14 | Leads need permission; no false claims | model [14]; UI intake + chat |
| 15 | Reload/reset/export/import, keyboard, mobile | model [15]; UI chat reload, Esc/focus, 390 px |
| 16 | Supplied logo and base palette | inspection |
| 17 | Admin creates → publishes → buyer sees | model [17]; UI section D |
| 18 | 10 + 4 unequal demand | model [18]; UI comparison |
| 19 | Capacity from order; price edits do not rewrite | model [19]; UI "@ $37.80" |
| 20 | Platform vs tenant scopes | model [20]; UI role separation |
| + | Reset demo → clean first-run state | UI "Reset demo returns every area…" |

## Not tested
Screen-reader sessions (NVDA/VoiceOver), Firefox/Safari, file-import dialog through the UI (import validation is covered at model level), real network failure.
