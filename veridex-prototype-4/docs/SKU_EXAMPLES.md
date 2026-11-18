# SKU and entitlement examples (illustrative demo catalog, USD)

## Licence metrics (v4) — several per product
Each product enables every metric that applies to it (VeriDex Admin → Products → Edit → *Licence metrics for this product*). Each SKU offers some or all of the product’s enabled metrics; the buyer picks one per order line. Prices are per product × tier × metric.
| Metric | Counts | Applies to | Example price |
| --- | --- | --- | --- |
| Per seat | People given the module (Core: per user) | Modules, VeriDex Core | Claims Std $42.00 / seat / month |
| Per module | Nothing — one fee, any number of users | Modules | Claims Std $2,100.00 / month |
| Per usage | Units used after an allowance, in arrears | Modules, add-ons | Claims Std $3.00 / claim |
| Flat fee | Fixed fee (workspace, session, system) | Add-ons, services | Client Portal $250.00 / month |
| Bundle seats | Person–module assignments in one bundle | Bundles | Complete Suite $35.00 / bundle seat / month |
| New / custom | Admin-defined name, unit and basis (seat, quantity, usage, fixed); must be ticked “New / custom” | Any | Risk Insights Std “Per vehicle” $0.90 / vehicle |

Rules: disabling a metric removes it from SKUs (draft) and blocks publish if a SKU has none left; each enabled metric needs a price per tier before publish; one product is licensed one way per workspace (same-tier per-seat lines add up; the same pool can be extended; any other mix is blocked).

### Bundle seats worked example (v4)
`VDX-BND-SUITE` Complete Suite (Policy, Claims, Legal, Risk Insights) with shared bundle seats, $35.00 / bundle seat / month.
| Person | Modules | Bundle seats used |
| --- | --- | --- |
| Vikram | Policy, Claims, Legal | 3 |
| 4 claims handlers | Claims | 4 |
| Admin (no modules) | — | 0 (free) |
| **Total** | | **7 of the pool** |
Buy 7+ bundle seats (minimum 2). Each person with any module access still needs one VeriDex Core user licence (5 here). Assignment is blocked once the pool is used up; Tenant Admin → *Buy bundle seats* extends it after simulated payment.


## Licence metrics (v3, superseded by v4 above — kept for history)
| Metric | What is counted | Sold for | Example SKU | Price |
| --- | --- | --- | --- | --- |
| Per user | People who use any module (admins with no module seat are free) | Platform access | `VDX-CORE-USR` VeriDex Core user licence | $15.00 / user / month |
| Per module seat | A seat in each module a person uses | Modules, bundles | `VDX-CLM-STD`, `VDX-BND-CL`, `VDX-SUB-STD` | $22–$84 / seat / month |
| Flat fee | Nothing — fixed price, whole workspace | Add-ons; setup services | `VDX-ADD-PORTAL` Client Portal $250 / month; `VDX-ADD-AI` AI Assistant $300 / month | |
| Usage | Units used, after an included allowance | Add-ons | `VDX-ADD-PAY` Digital Payments | $0.75 / payment after 100 included / month |

Charge type: **recurring** (everything above) or **one-time** (setup services only):
| SKU | Unit | Price |
| --- | --- | --- |
| `VDX-SVC-MIG` Data migration | per source system (1–5) | $2,500.00 once |
| `VDX-SVC-CFG` Initial configuration | per engagement (1) | $1,500.00 once |
| `VDX-SVC-TRN` Private staff training | per session (1–20) | $600.00 once |

**Hosted access & support (SMA):** 15% of recurring licence fees (per user, per seat, flat). Not on usage or one-time services. Configurable in VeriDex Admin → Pricing.

**Order of charges:** licence fees (after bundle discount) + SMA → × months → − annual prepay 10% → + one-time services → + tax 8.25% (demo) = due today. Usage is billed monthly in arrears; $0 at purchase.

### Worked example (v3)
10 Claims + 4 Legal via `VDX-BND-CL`, 10 Core user licences, Digital Payments, Initial configuration, monthly:
| Line | Amount |
| --- | --- |
| Claims & Legal bundle: 10×$37.80 + 4×$52.20 | $586.80 / month |
| VeriDex Core: 10 × $15.00 | $150.00 / month |
| Licence fees | $736.80 / month |
| SMA 15% | $110.52 / month |
| Recurring | $847.32 / month |
| Initial configuration (one-time) | $1,500.00 |
| Digital Payments | $0.00 today; $0.75 per payment after 100 |
| Tax 8.25% on $2,347.32 | $193.65 |
| **Due today** | **$2,540.97** |


## Price book v1 — per seat per month
| Module | Standard | Advanced |
| --- | --- | --- |
| Policy | $36.00 | $54.00 |
| Claims | $42.00 | $64.00 |
| Legal | $58.00 | $84.00 |
| Risk Insights | $28.00 | $46.00 |

Annual prepay: −10% on the 12-month total. Tax estimate: 8.25% demo rate.

## SKUs
| SKU | Type | Audience | Contents | Quantity rule | Price rule |
| --- | --- | --- | --- | --- | --- |
| `VDX-POL-STD` … `VDX-INS-ADV` (8) | Individual | tenant, carrier | one module, one tier | seats 1–500 | list price |
| `VDX-BND-CL` Claims & Legal | Bundle | tenant, carrier | Claims Std + Legal Std | seats **per module** 1–500 | 10% off each module |
| `VDX-BND-SUITE` Complete Suite | Bundle | tenant, carrier | all four, Standard | seats per module | 18% off each |
| `VDX-BND-CO` Carrier Operations | Bundle | carrier | Policy Adv + Claims Adv | seats per module | 12% off each |
| `VDX-BND-CSUITE` Carrier Complete Suite | Bundle | carrier | all four, Advanced | seats per module | 20% off each |
| `VDX-BND-TEAM5` Team Pack 5+5 | Fixed bundle | tenant | 5 Claims Std + 5 Legal Std per pack | packs 1–50 | $420.00 / pack |

## Entitlement expansion
Order line → one entitlement per included module; capacities stay separate.

```
Line: VDX-BND-CL  seats {Claims: 10, Legal: 4}
  → entitlement Claims Standard  +10   (unit $42.00 → $37.80)
  → entitlement Legal  Standard  +4    (unit $58.00 → $52.20)
Line: VDX-BND-TEAM5  packs 2
  → Claims Standard +10, Legal Standard +10   (2 × $420.00)
```

## Worked example: needs 10 Claims + 4 Legal
| Option | Buyer enters | Capacity | Seats beyond need | Monthly |
| --- | --- | --- | --- | --- |
| Individual modules | 10 and 4 | 10 / 4 | 0 | 10×42.00 + 4×58.00 = **$652.00** |
| Claims & Legal bundle | 10 and 4 | 10 / 4 | 0 | 10×37.80 + 4×52.20 = **$586.80** (saves $65.20) |
| Complete Suite | 10, 4 + min 1 Policy, 1 Insights | 1 / 10 / 4 / 1 | 2 | $587.12 |
| Team Pack 5+5 | 2 packs | 10 / 10 | **6 Legal** (disclosed) | **$840.00** |

The comparison above is module seats only. From v3 every order with module seats also needs VeriDex Core user licences (one per person) and carries SMA; see the v3 worked example at the top.

## Overlap rules
- Same module, same tier, two SKUs: capacities add; each line charged once. `VDX-BND-CL` (10 Claims) + `VDX-CLM-STD` (3) → 13 Claims.
- Same module, two tiers: blocked until one is removed.
- Re-adding a SKU replaces its line (no duplicates).
- New order vs existing workspace at another tier: blocked → plan-change request.

## Licensing example (brief §4)
Legal 5, Claims 3. Admin uses neither → 0 seats. Alex in both → Legal 1/5, Claims 1/3. Legal filled to 5 → sixth Legal assignment refused; Claims spare seats do not help.
