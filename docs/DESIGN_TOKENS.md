# VNTax.ai — Design Token System

**Status:** implemented on branch `design/wise-token-system`
**Structural source:** Wise Design System (WDS), extracted from wise.com's live compiled CSS
**Color identity:** unchanged — VNTax jade / navy / clay / gold / ink

## What this change is, and what it is not

This is a **structural** redesign, not a rebrand. The jade palette stays exactly as it was. What changed is the token architecture underneath it: naming, scale discipline, and the typographic technique that makes large headlines feel deliberate instead of loose.

We borrowed Wise's structure specifically because Wise is the benchmark for a multilingual product design system (342 languages, disciplined token scales) **and is not a tax-prep competitor** — so borrowing its architecture carries none of the brand-collision risk that copying KeeperTax's navy/grape palette did.

| Element | Adopted from Wise | Why |
|---|---|---|
| Semantic token naming (`content-*`, `interactive-*`, `sentiment-*`, `surface-*`) | Yes | Good architecture, invisible to users, zero collision risk |
| Type scale 12→48 with paired line-heights | Yes | Structural, not visually distinctive |
| Negative tracking that tightens as display type grows | Yes | This is what makes big headlines read as confident |
| Radius scale 10 / 16 / 24 / 32 / pill | Yes | Structural |
| Spacing scale 8 / 16 / 24 / 32 / 40 / 56 / 72 | Yes | Structural |
| Bright-green + forest-green palette | **No** | Wise's visual signature |
| "Wise Sans" typeface | **No** | Proprietary, and unverified for Vietnamese diacritics |

## Token layers

Tokens live in two mirrored places:

1. `tailwind.config.js` — consumed by application code via utility classes.
2. `src/index.css` `:root` — CSS custom properties (`--vn-*`) for surfaces Tailwind does not reach: transactional email, future embeds, and the planned Next.js migration.

Keep them in sync. If you add a token, add it to both.

### Semantic color aliases

Prefer these over raw ramp steps (`text-ink-500`) in new code:

| Alias | Value | Use |
|---|---|---|
| `content-primary` | `#1A1815` | Body and heading text |
| `content-secondary` | `#54514A` | Supporting text, labels |
| `content-muted` | `#6E6B63` | Captions, hints |
| `interactive-primary` | `#155E4C` | Primary button / active nav |
| `interactive-hover` / `interactive-active` | `#10493B` / `#0C3830` | Button states |
| `sentiment-positive/warning/negative/info` | jade / gold / clay / navy | Status meaning |
| `surface-base` / `surface-sunken` / `surface-inverse` | white / cream / navy-900 | Elevation |

The raw ramps (`jade-*`, `navy-*`, `clay-*`, `gold-*`, `ink-*`) remain available and unchanged — nothing existing broke.

### Type scale

Each step ships its own line-height and letter-spacing. Tracking goes from `+0.01em` at 12px to `−0.03em` at 48px.

| Class | Size | Line-height | Tracking |
|---|---|---|---|
| `text-xs` | 12 | 18 | +0.01em |
| `text-sm` | 14 | 20 | +0.005em |
| `text-base` | 16 | 24 | 0 |
| `text-lg` | 18 | 28 | 0 |
| `text-xl` | 20 | 28 | −0.005em |
| `text-2xl` | 24 | 30 | −0.01em |
| `text-3xl` | 28 | 34 | −0.015em |
| `text-4xl` | 32 | 38 | −0.02em |
| `text-5xl` | 40 | 46 | −0.025em |
| `text-6xl` | 48 | 54 | −0.03em |

Two component classes apply the display treatment: `.display-hero` (hero headline, tightest tracking) and `.display-section` (section headings, page titles, stat values).

### Radius scale

`rounded-sm` 10px (inputs, nav items) · `rounded-lg` 16px (cards) · `rounded-2xl` 24px (feature panels) · `rounded-3xl` 32px (hero containers) · `rounded-full` (all buttons).

All actions are now full-pill. That is a deliberate call for this audience: a fully rounded shape reads as "tappable" faster than a soft rectangle, which matters for owners with lower software confidence.

## Vietnamese diacritic safety — the hard constraint

Vietnamese tone marks (ề, ộ, ẫ, ữ) stack above the cap height. Tight leading clips them, and this is the single most common way a display typeface fails on Vietnamese text.

**Both shipped faces are verified for full Vietnamese coverage:**

- **Be Vietnam Pro** (body/UI) — purpose-built for Vietnamese.
- **Lora** (display) — Google Fonts serves a dedicated `vietnamese` subset covering `U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB`.

Guardrails in `src/index.css`:

- `h1, h2, h3` carry an explicit `line-height: 1.22` floor so headings never inherit a clipping leading.
- `.display-hero` bottoms out at `1.16` — tight enough to look intentional, loose enough to clear stacked tone marks.

**Never set display headings below `leading-[1.16]`.** The old code used Tailwind's `leading-tight` (1.25) inconsistently and relied on default tracking; that combination is what produced the earlier diacritic clipping.

Any future display typeface must be tested against the full tone-mark set before it ships:

à á ả ã ạ ă ằ ắ ẳ ẵ ặ â ầ ấ ẩ ẫ ậ đ ê ề ế ể ễ ệ ô ồ ố ổ ỗ ộ ơ ờ ớ ở ỡ ợ ư ừ ứ ử ữ ự ỳ ý ỷ ỹ ỵ

## Migration notes

- `rounded-xl` now resolves to 16px (was 12px) and `rounded-2xl` to 24px (was 16px). This is intentional scale alignment, applied repo-wide.
- Existing color ramp classes are untouched, so unconverted screens still render correctly. Convert to semantic aliases opportunistically.
