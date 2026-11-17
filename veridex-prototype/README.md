# VeriDex enterprise prototype

Interactive HTML/CSS/JS prototype of VeriDex purchasing, guided assistance, post-purchase onboarding, tenant licence administration and platform (VeriDex) commercial administration. Built 17 Nov 2026 from the rebuild brief.

**Everything is simulated.** Prices and offers are illustrative. No payment, identity check, email, chat service, CRM or provisioning happens. Data lives in this browser's localStorage.

## Run

```bash
cd veridex-prototype
python3 -m http.server 8765        # or: npx serve .
# open http://localhost:8765/
```
No build step, no dependencies. ES modules need HTTP (not file://).

## Pages

| Page | Who | What |
| --- | --- | --- |
| `index.html` | Tenant buyer | Shop → review → simulated checkout → confirmation |
| `carrier.html` | Carrier buyer | Separate carrier journey, own offers, own draft |
| `assistance.html[?p=carrier]` | Any buyer | Guided "help me choose" request |
| `onboarding.html[?p=carrier]` | Purchaser/admin | 5-step setup, locked until payment |
| `tenant-admin.html[?p=carrier]` | Workspace admin | Seats, people, invitations, billing, activity |
| `veridex-admin.html` | VeriDex staff | Products, prices, SKUs, publish, quote preview, customers, orders, audit |
| `demo-leads.html` | VeriDex staff | Simulated lead/follow-up inbox |

**Demo tools** (top strip, every page): load a scenario, export/import JSON, reset.

## Tests

```bash
node tests/run.mjs                 # 21 model tests (acceptance criteria 1–15, 17–20)
pip install playwright && playwright install chromium
python3 tests/ui_e2e.py            # 40 browser checks, writes docs/screenshots/
```
Results: `docs/TEST_RESULTS.md`.

## Structure

```text
index.html carrier.html onboarding.html tenant-admin.html veridex-admin.html assistance.html demo-leads.html
assets/brand   logo PNGs extracted from the supplied PDF      assets/css   tokens, base, components
assets/icons   SVG sprite                                     data/        seed catalog, personas, sample CSV, sample leads
models/        business rules and state (no DOM)              services/    storage + mock adapters (payment, identity, invitations, chat, CRM), scenarios
controllers/   events and transitions                         views/templates/  pure render functions (escaped templating)
tests/         model tests + browser walk-through             docs/        architecture, research, tokens, SKU examples, walkthrough, assumptions
```

## Docs

- `docs/WALKTHROUGH.md` — demo script
- `docs/ARCHITECTURE.md` — architecture, data model, production boundaries
- `docs/RESEARCH.md` — vendor research and the bundle model decision
- `docs/SKU_EXAMPLES.md` — SKUs, entitlements, 10 + 4 worked example
- `docs/BRAND_TOKENS.md` — palette, tokens, logo handling, contrast
- `docs/ASSUMPTIONS.md` — assumptions, additions, deferred integrations, open questions
- `docs/TEST_RESULTS.md` — test output
