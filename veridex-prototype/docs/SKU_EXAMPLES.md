# SKU and entitlement examples (illustrative demo catalog, USD)

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

Bundle, monthly: $586.80 + tax $48.41 = **$635.21** due today.
Bundle, annual: 586.80×12 = 7,041.60 − 10% (704.16) = 6,337.44 + tax 522.84 = **$6,860.28**; monthly equivalent $528.12.

## Overlap rules
- Same module, same tier, two SKUs: capacities add; each line charged once. `VDX-BND-CL` (10 Claims) + `VDX-CLM-STD` (3) → 13 Claims.
- Same module, two tiers: blocked until one is removed.
- Re-adding a SKU replaces its line (no duplicates).
- New order vs existing workspace at another tier: blocked → plan-change request.

## Licensing example (brief §4)
Legal 5, Claims 3. Admin uses neither → 0 seats. Alex in both → Legal 1/5, Claims 1/3. Legal filled to 5 → sixth Legal assignment refused; Claims spare seats do not help.
