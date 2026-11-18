# Research rationale and bundle model decision

Checked 17 Nov 2026.

**Access note.** The four URLs in the brief (microsoft.com M365 Family page, support.microsoft.com sharing page, atlassian.com Jira pricing, atlassian.com cloud licensing) could not be fetched directly from the build environment (network allowlist). Facts below come from web search results of official Microsoft Support, Microsoft Learn and Atlassian Support/licensing pages returned that day, plus third-party summaries where marked. Page *layouts* were not observed first-hand; interaction patterns are therefore adopted from the documented behaviour, not copied from visuals. No vendor prices, limits or terms are used in VeriDex.

## Observed vendor behaviour

### Microsoft (preferred model)
| Source | Observed |
| --- | --- |
| Microsoft Support — Share your Microsoft 365 subscription | Owner shares with up to five other people; invites by **email or copied link**; invite must be accepted within a time window and shows as **"Pending invite"**; only the owner manages sharing. |
| Microsoft Support — Manage Microsoft 365 subscription sharing | Owner views members; **"Stop sharing"** per person; at the limit, must stop sharing with one person before adding another. |
| Microsoft Learn — Understand subscriptions and licenses (business) | A subscription is a product SKU; a licence is a seat assigned to a user. Admin roles are separate from licences: Billing admin can **buy** licences but not assign; License admin can **assign** but not buy. |
| Third-party how-to (not official) | An admin account can exist with no product licence. |

Quantity model: Family = **fixed package** (one price, fixed people limit). Business suites = **one suite seat per user** covering all apps (single common count).

### Atlassian (secondary)
| Source | Observed |
| --- | --- |
| Atlassian Support — How billing works for Collections | A collection is **one billable line item** at a single price instead of separate app lines. Billed on **unique users across the included apps**: anyone with access to at least one app counts once. |
| Atlassian licensing / pricing FAQs | Standalone apps are billed per app on that app's users. Monthly = per user; annual = user tiers. Removing inactive users lowers the monthly count. |
| Atlassian community / third-party (not official) | Pricing page pattern: tier columns, user-count input, monthly/annual toggle, annual saving shown. |

Quantity model: standalone = **separate count per app**; collection = **one common suite-user count**.

## Candidate models for VeriDex bundles

Test case: 10 Claims users, 4 Legal users, different unit prices.

| | A. Common suite count (Atlassian Collection, M365 Business) | B. Fixed package (M365 Family) | C. Separate count per module inside one bundle SKU |
| --- | --- | --- | --- |
| Buyer enters | one number | number of packs | one number per module |
| 10 + 4 demand | must buy 10 suite seats → 6 unused Legal | 2 packs of 5+5 → 6 unused Legal | exactly 10 and 4 |
| Different unit prices | hidden in a blended price | hidden in pack price | visible per module; discount % on each |
| Discount | blended suite price | pack price vs list | bundle % per module, like-for-like vs standalone |
| Overlap with standalone | ambiguous (who is a suite user?) | adds capacity | adds capacity, same tier only |
| Quantity change | one number, all modules move together | whole packs | per module, independently |
| Upgrade / renewal | whole suite tier | whole pack | per SKU; components keep their tier |
| Fit with VeriDex rule "licences are not pooled; one seat per module per person" | **Conflicts**: implies shared entitlement | Compatible, wasteful on uneven teams | **Direct fit** |

## Decision

**Recommendation and implementation: model C as the default** — a bundle is a first-class SKU with a seat count per included module and a bundle discount applied to each module's unit price. **Model B is also supported** as an optional, clearly labelled fixed pack. Model A is not offered.

Why:
1. VeriDex's non-negotiable rules make capacity per module. A common suite count would either pool seats or silently overbuy.
2. The user needs differing prices per module and uneven head-counts. C keeps both visible.
3. Savings claims stay honest: same tiers, same quantities, standalone vs bundle.
4. B stays useful for simple small-team packs. The shop's "Seats needed" comparison discloses seats beyond need before purchase and offers C or standalone instead.

Trade-offs accepted: C asks for more inputs than a single number (mitigated by the "Seats needed" tool that fills them); a bundle minimum of 1 seat per module can add seats a buyer did not ask for in wide bundles (disclosed as "seats beyond need").

## Patterns adopted
- From Microsoft Family: offer card that states what is included; invite by email after purchase; "pending" state; per-person stop/revoke; hard stop at the limit with a clear next step.
- From Microsoft business licensing: SKU → seats assigned to users; admin role independent of licence; separate permissions for buying and assigning (mirrored in VeriDex platform roles and the free workspace administrator).
- From Atlassian: tier comparison, quantity estimator, monthly/annual toggle with saving, bundle as one line item on order and receipt.

## Not adopted
Vendor branding, layouts, prices, consumer family eligibility, owner benefits, unique-user billing, user-tier bands, automatic billing on user add.
