# Brand tokens and logo handling

## Logo
Source: `VeriDex. Primary Logo.pdf` (9 pages, Keynote export). **The PDF contains raster images only (JPEG), no vector paths and no written clear-space or usage rules.** Flagged conflict: a clean vector asset could not be extracted. Nothing was traced, retyped or redrawn; the actual artwork is used as high-resolution transparent PNG.

| File | From | Use |
| --- | --- | --- |
| `assets/brand/veridex-logo-primary.png` | page 7 (VeriDex SOLUTION.AI, white ground) | header, purchase confirmation, onboarding finish, assistance confirmation |
| `assets/brand/veridex-logo-tagline.png` | page 8 (tagline lock-up) | footer |
| `assets/brand/veridex-mark.png` | page 9 (VD mark) | narrow-screen header |
| `assets/brand/favicon-32.png`, `favicon-180.png` | page 9 | favicon / touch icon |

Processing: crop to artwork, white background → transparency (threshold ramp, colours untouched), downscale. Geometry, wordmark, proportions and gradient unchanged. Aspect ratio fixed by width/height attributes.
Rules applied (inferred, because none are supplied): light backgrounds only (cream/white); no recolouring, no monochrome version (not provided in the PDF); clear space ≥ the height of the "V" stroke via header padding; minimum header height 44 px, mark-only below 640 px for legibility. The palette pages inside the PDF were ignored as instructed.
**Needed from brand owner:** vector (SVG/AI) logo, clear-space and minimum-size rules, any reversed/mono variant.

## Confirmed base palette (`Veridex_CP_02.jpg`, printed labels)
| Token | Hex | Role |
| --- | --- | --- |
| `--rust` | `#903018` | Primary: actions, links, current state, errors |
| `--coral` | `#EB854A` | Primary accent (never behind white text) |
| `--teal` | `#367467` | Success, tenant journey, chat |
| `--steel` | `#44768C` | Info, carrier journey, focus ring, checklist |
| `--ochre` | `#B97621` | Warning, reserved seats |
| `--cream` | `#FDF9EE` | Page background |
| `--warm-surface` | `#F9ECDE` | Secondary surface, table heads |
| `--warm-grey` | `#E4DCD3` | Borders, tracks, disabled |
| `--grey` | `#A4A7AB` | Neutral (decorative only) |

## Derived (not additional approved colours)
- Tints: `--rust-80/20/10`, `--coral-60/20`, `--teal-80/40/20`, `--steel-40/20`, `--ochre-40/20` = `color-mix(base N%, white)`, matching the sheet's 80/60/40/20% steps (10% added for subtle fills).
- Shades for text/hover: `--rust-dark #6F2412`, `--teal-dark #285A50`, `--steel-dark #33596A`, `--ochre-dark #7A4D12`.
- Readability neutrals: `--white #FFFFFF`, `--ink #2A1A12`, `--ink-2 #5A4A40`, `--border-strong #8C8078`.

- UI neutrals (refresh v2): `--line` (warm grey 72% over white, hairlines), `--side-bg` (warm surface/cream mix, sidebar and table heads), `--track` (segmented-control track).

## Semantic tokens
`--primary` rust · `--success` teal · `--info` steel · `--warning` ochre · `--danger` rust · `--focus` steel (3 px ring) · `--disabled-bg` warm grey · persona accent `--persona` (teal tenant / steel carrier / rust platform). Full list: `assets/css/tokens.css`.

## Contrast (calculated, WCAG 2.x ratio)
| Pair | Ratio | Need |
| --- | --- | --- |
| Ink on cream | 15.91 | 4.5 |
| Secondary text on cream / warm surface / white | 8.02 / 7.27 / 8.44 | 4.5 |
| White on rust (primary button) | 8.01 | 4.5 |
| Rust on white / cream / rust-10 | 8.01 / 7.61 / 6.78 | 4.5 |
| White on teal | 5.45 | 4.5 |
| Teal-dark on teal-20 | 5.98 | 4.5 |
| Steel-dark on steel-20 | 5.85 | 4.5 |
| Ochre-dark on ochre-20 | 5.79 | 4.5 |
| Input border on white | 3.84 | 3.0 |
| Focus ring on cream | 4.73 | 3.0 |
| White on coral / white on ochre | 2.63 / 3.70 | fails → **not used for text** |

Status is never colour-only: badges carry icon + word; seat meter uses solid vs hatched fill plus numbers and a text label; errors have icon, text and summary. WCAG 2.2 AA targeted and spot-verified (contrast, keyboard, focus, reduced motion). No formal certification claimed.

## Type and spacing
Stack: `Inter` if installed, else `Segoe UI` / system-ui — no web-font download, works offline. Base 15 px, headings weight 560–600 with tight tracking. 4-px spacing scale, 10/16/20 px radii.

## UI refresh v2 (reference: `vdx-sample-ui`)
Ideas adopted: left sidebar shell with grouped navigation, slim top bar with status pill, soft paper background, hairline white cards, pill segmented controls, numbered step pills, icon tiles on product cards, large light totals, blurred dialog backdrop. Not adopted: its colours, typed wordmark/logo, copy, product names, prices, code.
