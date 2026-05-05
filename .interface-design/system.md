# Velox — Design System

> Single source of truth for the Velox app's visual language. Used by BRD Assistant, Jira, Confluence, the global sidebar/header, profile, organization-usage, and (after Stage 5 of the current refactor) the Design Assistant module. Extends `src/index.css`, `src/styles/animations.css`, and the shadcn primitives in `src/components/ui/`.

---

## 1 · Overview

Velox is Deluxe's internal SDLC tool. The visual language is **clean SaaS with a restrained editorial overlay**:

- **One typeface family**: Helvetica Neue (system fallback). For numbered section marks and tabular displays, the **system monospace stack** (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) — never a webfont.
- **Pink-tinted off-white page** (`--background: 350 100% 97.5%`), pure-white cards, hairline grey borders.
- **Crimson** (`--primary: 355 84% 45%`) is the only saturated accent. It appears as: primary CTAs, sidebar active pip, wordmark dot, links, eyebrow text, section-mark numerals, focus rings, and translucent gradient washes.
- **Editorial accents are real, but precise.** Numbered section marks, gradient hero headlines, eyebrow pills, decorative ghost icons in card corners, and a fractal-noise paper-grain texture are all canonical (`src/styles/animations.css` calls them out as "Editorial / craft pass — paper grain, section marks, ledger ornaments"). They are layered onto pure-white cards over a faint pink page, NEVER onto cream/parchment.
- All colour tokens are HSL CSS variables, themable via `data-theme="deluxe"` (crimson, the canonical) or `data-theme="siriusai"` (navy, the rebranded variant). The Design Assistant follows the Deluxe theme.

**Scope:** the entire app. The Design Assistant module currently violates this language with **the wrong typefaces** (Spectral, Familjen Grotesk, JetBrains Mono) and **the wrong surface colour** (cream/parchment) — not because its editorial vocabulary is wrong, but because it picks the wrong specifics. Stage 5 of the refactor swaps the typefaces and surfaces, keeping the editorial structure where it maps to a canonical `usage-*` pattern.

---

## 2 · Colour tokens

All values from `src/index.css` (`:root[data-theme="deluxe"]`) unless flagged **(new)**. Express in HSL components for Tailwind's `hsl(var(--*) / <alpha-value>)` indirection.

### Foundation surfaces

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--background` | `350 100% 97.5%` | `#FFF0F4` | Page background (faint pink wash) |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card / elevated surface — main content lives here |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Popovers, dropdowns, dialogs |
| `--muted` | `210 40% 96.1%` | `#F1F5F9` | Inset / subdued surface |
| `--accent` | `350 100% 97.5%` | `#FFF0F4` | Hover wash; matches background |
| `--border` | `214.3 31.8% 91.4%` | `#E2E8F0` | Hairline borders |
| `--input` | `214.3 31.8% 91.4%` | `#E2E8F0` | Form-control border |
| `--ring` | `355 84% 45%` | crimson | Focus ring colour |

### Ink (text)

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--foreground` | `222.2 84% 4.9%` | `#020817` | Default body text — used by gradient endpoints + headings |
| `--heading-primary` | `0 0% 23%` | `#3B3B3B` | Headings + canonical body-dark text (set by `index.css` h1–h6 rule) |
| `--ink-body` **(new)** | `0 0% 23%` | `#3B3B3B` | Body text token. Replaces drift hex `#3B3B3B` literal |
| `--ink-muted` **(new)** | `0 0% 45%` | `#727272` | Secondary text. Replaces drift greys `#727272`/`#747474`/`#858585`/`#6C6C6C` |
| `--muted-foreground` | `0 0% 23%` | `#3B3B3B` | shadcn-default secondary text. **Note:** the Deluxe theme overrides this to match `--heading-primary`, so `text-muted-foreground` reads dark in this app, not the typical `slate-500` |

### Accent — Deluxe crimson

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--primary` | `355 84% 45%` | `#D31528` | Primary CTAs, sidebar active pip, links, eyebrow text, section-mark numerals |
| `--primary-light` | `355 100% 95%` | `#FBE7E9` | Soft pink wash — wordmark strip background, hover glows |
| `--primary-selected` | `355 100% 97%` | `#FDEDEF` | Selected/active row background — sidebar item, table row, list item |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on a crimson surface |

### Semantic & exception

| Token | HSL | Hex | Role |
|---|---|---|---|
| `--destructive` | `0 84.2% 60.2%` | `#EF4444` | Destructive confirms only |
| `--destructive-foreground` | `210 40% 98%` | `#F8FAFC` | Text on destructive |
| `.badge-success` (utility) | bg `#DBFCE7` / fg `#008236` | — | The only success colour pair |
| `--audit-pass` **(new)** | `158 60% 30%` | green | **Scoped exception** — SAD audit pass pip only |
| `--audit-warn` **(new)** | `30 90% 42%` | amber | **Scoped exception** — SAD audit warn pip only |

---

## 3 · Typography

### Family

```
font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

Single sans family, system-stack fallbacks. **No webfont is loaded.** For monospace usage (section-mark numbers, tabular code-style displays), use the **system monospace stack** declared inline in `animations.css`:

```
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

**Forbidden** (used by Design Assistant today, removed in Stage 5):
- Spectral (serif headings + italic marginalia) — replace with Helvetica Neue.
- Familjen Grotesk (sans alternative) — replace with Helvetica Neue.
- JetBrains Mono (eyebrow caps, plate codes) — replace with the **system monospace stack** above.

### Hierarchy

| Token | Size | Line-height | Weight | Tracking | Where |
|---|---|---|---|---|---|
| Hero display | `text-4xl sm:text-5xl` | tight | 700 | `tracking-tight` (`-0.025em`) | Page hero ("Team Usage"). Almost always paired with `.usage-text-gradient` and `.usage-num-display`. |
| H1 | `text-3xl` | `1.2` | 700 | `-0.01em` | Page titles ("My Profile") |
| H2 | `text-2xl` | `1.25` | 600 | normal | `<CardTitle>` default + section headers |
| H3 | `text-xl` | `1.3` | 600 | normal | Subsection headers |
| H4 | `text-lg` | `1.4` | 600 | normal | Card sub-headers |
| Body | `text-[15px]` | `1.5` | 400 | normal | Default paragraph / list text |
| Body-sm | `text-sm` | `1.5` | 400 | normal | Dense lists, helper text |
| Caption | `text-xs` | `1.4` | 500 | normal | Timestamps, meta |
| Eyebrow | `text-[10–11px]` | `1` | 600 | `0.14–0.18em` | Uppercase Helvetica. Used in table column headers, tab labels, status pills. **Always uppercase, always tracked.** |
| Section-mark | `text-[11px]` | `1` | 600 | `0.22em` | Uppercase **system monospace** for the numbered "01 ORGANISATION USAGE" pattern. Number coloured `--primary`. |
| Numeric display | inherits size | `1` | 700 | `-0.02em` | `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum" 1, "ss01" 1`. Used for big stat numerals AND for usernames in dense lists where alignment matters. |

### Numerics

**Tabular figures are canonical.** Use `font-variant-numeric: tabular-nums` (or `.usage-num-display`) for any column of numbers, any large stat, and any timestamp/count where alignment matters. This is the opposite of an editorial "fluid" body — Velox treats numbers as data, not prose.

---

## 4 · Spacing scale

Tailwind's default 4px-base scale. The values that actually appear in canonical UI:

| Token | Value | Common use |
|---|---|---|
| `1` | 4px | Icon-text micro-gap |
| `2` | 8px | Tight inline gaps |
| `3` | 12px | Sidebar item padding (vertical), input padding |
| `4` | 16px | Card body row spacing |
| `6` | 24px | Card padding (`<CardHeader>` / `<CardContent>`) |
| `8` | 32px | Page-level section gaps |
| `12` | 48px | Hero block bottom margin |

---

## 5 · Border radius

```
--radius: 0.5rem;   /* 8px */
```

| Tailwind | Computed | Use |
|---|---|---|
| `rounded-sm` | 4px | Inline tags, tight chips |
| `rounded-md` | 6px | Buttons, inputs, dropdowns |
| `rounded-lg` | 8px | **Cards** (`<Card>` default), modals, alerts |
| `rounded-xl` | 12px | Large feature cards (rare) |
| `rounded-full` | 9999px | Avatars, pill badges, status dots, eyebrow pills |

**Don't:** introduce 2px / 10px / 14px / 20px ad-hoc radii.

---

## 6 · Shadow & elevation

Velox uses two elevation systems. Most surfaces use shadcn's flat scale; display surfaces (stat cards, hero areas) use the soft `usage-card-soft` lift.

| Class | Shadow | Use |
|---|---|---|
| `shadow-sm` | shadcn default | `<Card>` default, generic surfaces |
| `shadow` | shadcn default | Sticky headers, dropdowns |
| `shadow-md` | shadcn default | Floating menus, popovers |
| `shadow-2xl` | shadcn default | Dialogs / modals |
| `.usage-card-soft` | `0 1px 2px ink/0.04, 0 4px 16px -8px primary/0.08` → on hover lifts to `0 16px 40px -16px primary/0.30` + `translateY(-2px)` | **Display cards** — stat cards, content tiles. Defined in `animations.css` |

**Forbidden:** offset solid-colour "letterpress" shadows (`box-shadow: 2px 2px 0 ...`). These appear in `design-theme.css` and are removed in Stage 5.

---

## 7 · Component patterns (shadcn primitives)

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>...</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

Defaults: `bg-card`, `border` hairline, `rounded-lg` (8px), `shadow-sm`. Header/content padding `p-6`.

### Button

shadcn `<Button>` with `cva` variants:

| Variant | Use |
|---|---|
| `default` | Primary CTA |
| `outline` | Secondary action |
| `ghost` | Sidebar items, icon buttons, low-emphasis |
| `destructive` | Confirm-delete only |
| `link` | Inline text links (crimson, underline-on-hover) |

Sizes: `default` (h-10), `sm` (h-9), `lg` (h-11), `icon` (h-10 w-10). **Sentence case always — never `uppercase` + `tracking-widest` on button text.**

### Input

`h-10`, `rounded-md`, `border border-input`, `bg-background`, `px-3 py-2`, `text-sm`. Focus ring uses `--ring` (crimson).

### Badge

`rounded-full`, `px-2.5 py-0.5`, `text-xs font-medium`. Default uses `--primary`. The `.badge-success` utility gives green-on-mint.

### Sidebar item

```tsx
<Button variant="ghost" className="w-full justify-start h-auto p-3 text-left">
  <Icon className="h-4 w-4 mr-3" />
  <span>Label</span>
</Button>
```

Active state: `style={{ backgroundColor: 'hsl(var(--primary-selected))' }}` (the cyan inline literal was drift; fixed in Stage 4). Width 240px (`w-60`).

### Wordmark strip

64px-tall (`h-16`) bar at top of sidebar. `bg-primary-soft` (`hsl(var(--primary) / 0.06)`), `border-b border-border`. **Velo** in `--ink-body` weight 700 + lowercase **x** in `--primary` weight 700, `text-xs text-[hsl(var(--ink-muted))]` tagline below.

### Empty state

Centred prose on `--background`. Heading in `--heading-primary`, body in `--ink-muted`. Optional primary CTA. **No serif, no cream**, no italic marginalia.

---

## 8 · Display & editorial patterns (`usage-*` family)

These live in `src/styles/animations.css` and are **canonical Velox** for hero sections, stat cards, dense data lists, and any "look at this number" surface. Use them on display pages (Organization Usage, dashboards, hubs); they are inappropriate on form-heavy CRUD pages.

| Class | Anatomy | Where |
|---|---|---|
| `.usage-text-gradient` | Linear gradient `foreground → primary → foreground`, animated 8s shimmer, clip-path on text. | Hero headlines ("Team Usage"). |
| `.usage-num-display` | `font-feature-settings: "tnum" 1, "ss01" 1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em`. Plain Helvetica Neue, just feature-set up. | Big stat numerals + display headlines + dense names that need alignment. |
| `.usage-eyebrow` | 10px Helvetica, 600 weight, uppercase, `0.16em` tracking, crimson text on translucent crimson gradient pill (1px crimson border). `rounded-full`. | Small status / category pills ("EARLY ACCESS", "BETA"). |
| `.usage-section-mark` | 11px **system monospace**, 600 weight, uppercase, `0.22em` tracking, muted-foreground text. Has a `::before` pseudo-element rendering a 28px crimson-gradient horizontal rule. The numeral inside is wrapped in `.usage-section-num` and coloured `--primary` with `tabular-nums`. | Numbered section headings: `[—— 01 ORGANISATION USAGE]`. |
| `.usage-card-soft` | Quiet shadow + 2px hover lift. See §6. | Stat cards, tile cards. |
| `.usage-stat-card` | Radial-gradient pink wash from top-right corner, layered over white card. `::after` pseudo-element renders a gradient border (mask-composite trick). | The 4 stat cards on Org Usage page. |
| `.usage-ghost-icon` | Decorative lucide icon positioned bottom-right of a stat card, `--primary` at 7% opacity, drifts on hover. | The faded people / chart silhouettes in stat-card corners. |
| `.usage-row-accent` | 3px crimson-gradient left bar that scales in on row hover. | Dense table/list rows that benefit from a row-level focus signal. |
| `.usage-shimmer-sheen` | Diagonal white-translucent sweep across an element on hover. | Optional flair on stat cards, premium tiles. Use sparingly. |
| `.usage-toggle-shell` | Frosted-glass tabs background. | The Per user / Per module toggle. |
| `.usage-search-glow` | Focus-within crimson glow ring on input. | Search inputs on display pages. |
| `.usage-sheet-header` | Radial gradient header for slide-out sheets. | Sheet/drawer headers. |
| `.usage-grain` | Fractal-noise SVG paper grain, `multiply` blend at 32% opacity. | Top-right corner overlay on hero areas. The "paper" texture. |

**Naming:** these were authored for the Organization Usage page but apply to the whole app. Stage 5 may rename the family `display-*` for clarity, OR keep the `usage-*` prefix for backwards compatibility — pending decision.

---

## 9 · What's NOT in the system

Be precise: the editorial *vocabulary* is canonical (numbered section marks, eyebrow pills, gradient hero headlines, ghost icons, paper grain). What's forbidden is the wrong **specifics**:

- **No Spectral / Familjen Grotesk / JetBrains Mono.** Editorial labels use Helvetica Neue uppercase + tracking; section marks use the **system monospace stack** (`ui-monospace, SFMono-Regular, Menlo, ...`).
- **No cream / parchment surfaces.** Editorial accents sit on pure-white cards over the faint-pink page. Cream backgrounds (`hsl(36 35% 92%)` and similar) are forbidden.
- **No sepia italic marginalia.** Captions are upright Helvetica Neue, sentence case, in `--ink-muted`.
- **No letterpress offset shadows** (`box-shadow: 2px 2px 0 ...`). Use `shadow-sm` or `.usage-card-soft`.
- **No 2px border-radius.** Stick to the canonical 4 / 6 / 8 / 12 / full scale.
- **No navy as a primary accent** (under the Deluxe theme). Crimson is the only saturated accent.
- **No invented info / warning / error hues** beyond `--destructive`, `.badge-success`, and the `--audit-pass` / `--audit-warn` SAD-scoped exceptions.
- **No new colour palette tokens** beyond what's listed in §2.
- **No inline cyan `rgba(184, 218, 222, 0.34)`** for sidebar active state. Use `hsl(var(--primary-selected))`.

---

## 10 · Drift to fix in Stage 5

The Design Assistant's editorial vocabulary is mostly *correct* — it's the typefaces and surfaces that are wrong. Stage 5 is therefore a font + surface swap, not a vocabulary removal. Specifics:

### A · Replacements (preserve intent, swap specifics)

| In `design-theme.css` / `components/design/*` | Canonical replacement |
|---|---|
| `font-family: Spectral, ...` (Spectral serif) | `font-family: 'Helvetica Neue', ...` (canonical body) — for everything currently set in Spectral, including `.design-heading` and `.design-marginalia` |
| `font-family: 'Familjen Grotesk', ...` | `font-family: 'Helvetica Neue', ...` |
| `font-family: 'JetBrains Mono', ...` | `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |
| `--design-paper: hsl(36 35% 92%)` (cream/parchment) | `hsl(var(--background))` for page surface, `hsl(var(--card))` for cards |
| `--design-ink: hsl(218 55% 16%)` (navy ink) | `hsl(var(--ink-body))` |
| `--design-mark: hsl(355 84% 45%)` (crimson) | `hsl(var(--primary))` — same value, different token name |
| `.design-eyebrow` (JetBrains Mono caps) | `.usage-eyebrow` OR inline `text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--ink-muted))]` |
| `.design-cartouche` / `.design-plate-num` | `.usage-section-mark` + `.usage-section-num` |
| `.design-marginalia` (Spectral italic, sepia) | inline `text-sm text-[hsl(var(--ink-muted))]` (upright, sentence case) |
| `.design-btn-mark` | shadcn `<Button variant="default">` |
| `.design-btn-ghost` | shadcn `<Button variant="outline">` or `variant="ghost"` |
| `.design-btn-link` | shadcn `<Button variant="link">` |
| `.design-status-badge` | shadcn `<Badge>` with state-derived `data-state` styling |
| `.design-banner` | shadcn `<Alert>` (or a custom `<Card>` wrapper if `<Alert>` is too plain) |
| `.design-rise` / `.design-stagger` | Delete; rely on natural mounting |
| `.design-pulse-mark` | Tailwind `animate-pulse` |
| `box-shadow: 2px 2px 0 ...` letterpress | `shadow-sm` or `.usage-card-soft` |
| `border-radius: 2px` | `rounded-sm` (4px) |

### B · Outright deletions

- `src/styles/design-theme.css` — entire 919-line file. Any token still used elsewhere gets ported into `index.css` first. After Stage 5, remove the `@import './styles/design-theme.css'` line from `index.css`.
- `src/components/design/Cartouche.tsx` — replace usage with `.usage-section-mark` markup inline.

### C · Already fixed in Stage 4

- `src/styles/utilities.css` — five drift greys consolidated to `--ink-body` / `--ink-muted`.
- `src/components/layout/Sidebar.tsx` — inline cyan replaced with `--primary-selected`.
- `src/index.css` — added `--ink-body`, `--ink-muted`, `--audit-pass`, `--audit-warn` tokens across all four theme blocks.

---

## 11 · Open questions

Resolved before Stage 5:
1. ~~Greys in utilities.css~~ → consolidated to `--ink-body` / `--ink-muted` ✅
2. ~~Sidebar active row colour~~ → `--primary-selected` (pink, not cyan) ✅
3. ~~Body font~~ → Helvetica Neue ✅
4. ~~SAD audit pass/warn hues~~ → preserved as scoped `--audit-pass` / `--audit-warn` exception tokens ✅
5. ~~Editorial vocabulary~~ → canonical Velox; preserve intent in Stage 5, swap typefaces and surfaces only ✅

Pending:
- Whether to rename the `usage-*` class family to `display-*` for clarity now that it applies to multiple surfaces, or keep the `usage-*` prefix for backwards compatibility. Decision punted to Stage 5.
