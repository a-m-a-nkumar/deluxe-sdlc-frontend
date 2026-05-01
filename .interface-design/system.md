# Design Assistant — Design System

> Single source of truth for the Velox Design Assistant module, including the
> SAD-diagram-phase redesign currently in progress. Extends `src/styles/design-theme.css`.

---

## 1 · Overview

The Design Assistant helps engineers produce a Software Architecture Document (SAD) from inside Velox (the Deluxe internal SDLC tool). Each session has two phases: **Plate 00 — Drawing** (where the engineer authors up to three architecture diagrams: Logical, Infrastructure, Security) and **Plates 01–10 — Specification** (the SAD document itself, populated by an LLM). This system covers the visual + interaction language for both, with a focus on the SAD-diagram redesign for Plate 00.

**Direction:** *"The Design Assistant is the drafting table."*
The module sits on a parchment surface with a faint cyanotype grid that fades at the edges. The phase switcher reads like turning a sheet over. The session sidebar is the **portfolio** — a stack of named drafts. The chat is the **conversation in the margin**. Crimson is the only accent — the architect's red revision-mark pencil, used sparingly. No purple, no saffron, no drop shadows, no bouncy springs.

**Scope:** `pages/SessionDesignAssistant.tsx` and the components it composes. The rest of the app keeps the existing shadcn/Tailwind look. Tokens are namespaced `--design-*` so they don't collide with the global `--primary`/`--background`.

---

## 2 · Design principles (SAD-redesign, ranked)

Higher-numbered principles defer to lower-numbered ones in conflict.

### P1 — State is the receipt
**Rule:** Every saved or skipped action changes the hub's visible status — no toasts.
**Rationale:** Today the user saves a diagram and gets nothing. They click around to verify the save survived. The hub IS the proof of work; an additional banner is redundant when the row already says `Done ✓`.
**Yes:** Saving the Logical diagram changes its hub row from `Pending` to `Done ✓` immediately, with the timestamp. No toast.
**No:** A toast that says "Diagram saved" while the hub row still shows `Pending` until refresh.

### P2 — Skip is a verb, not a hidden gesture
**Rule:** Skipping any diagram is a one-click, labelled, reversible action on the hub row.
**Rationale:** Today there's no skip — users either fake a diagram or abandon Velox. Both poison the SAD or the trust.
**Yes:** Each Pending row has a `Skip` button next to `Generate`; skipped rows show `Skipped — Generate now` to invite reversal.
**No:** Skip lives in a "More actions ⋯" menu, requires a confirm modal, or is only available before any work begins.

### P3 — Honour every saved diagram in its own section
**Rule:** SAD §4, §6, §7 each read from the matching type's slot — never substitute one for another.
**Rationale:** Today the SAD silently uses the Logical slot for all three sections. A user who carefully drafted Security gets a SAD reviewers reject, and they don't know why.
**Yes:** §6 of the SAD shows the user's Security diagram if saved, else an explicit *"Security view skipped — open the hub to add it."* placeholder.
**No:** §6 silently rendering the Logical SVG when no Security diagram exists.

### P4 — One decision per surface
**Rule:** A user is never asked to choose tool, type, and content on the same screen.
**Rationale:** Today's congestion comes from stacking the tool toggle, the 3-card type picker, and the editor on one viewport. Each decision deserves its own moment.
**Yes:** Tool selection is its own screen, then the hub, then a focused editor for one type at a time.
**No:** A "consolidated" view that shows tool, type, and editor side-by-side to "save clicks."

### P5 — Returning never destroys
**Rule:** Reopening a Done diagram preserves the saved artifact until the user explicitly re-saves.
**Rationale:** Today, switching diagram types clears the in-flight prompt + XML. Engineers learned not to switch. The redesign asks them to switch freely; that promise breaks if reopening loses anything.
**Yes:** Click `Reopen` on a Done Logical → the saved XML loads into the editor; closing without saving leaves the original intact.
**No:** Reopening immediately clears the editor "to encourage a fresh take," or auto-saves any keystroke.

---

## 3 · Color tokens

Defined in [src/styles/design-theme.css](../src/styles/design-theme.css). All tokens are HSL components (no `hsl()` wrapper) so callers can use them in arbitrary alpha contexts.

### Existing tokens (unchanged)

| Token | Value | Role |
|---|---|---|
| `--design-ink` | `218 55% 16%` | Primary text — graphite-navy |
| `--design-ink-soft` | `218 30% 32%` | Secondary text |
| `--design-ink-muted` | `218 15% 48%` | Tertiary / metadata |
| `--design-paper` | `350 100% 97.5%` | Base parchment (Deluxe blush) |
| `--design-paper-deep` | `350 60% 95%` | Card / inset surface |
| `--design-paper-warm` | `36 35% 92%` | Margin / aside / banner surface |
| `--design-rule` | `218 30% 78%` | Hairline borders |
| `--design-rule-strong` | `218 45% 28%` | 2px emphasis rules |
| `--design-mark` | `355 84% 45%` | Deluxe crimson — THE accent |
| `--design-mark-soft` | `355 100% 95%` | Hover/selected tints |
| `--design-mark-deep` | `355 80% 32%` | Pressed/active state, Failed badges |
| `--design-sepia` | `30 40% 38%` | Margin notes |
| `--design-emerald` | `158 60% 30%` | Audit GREEN, Done state |
| `--design-amber` | `30 90% 42%` | Audit AMBER, Skipped pip |

### New tokens introduced by the redesign

| Token | Value | Role |
|---|---|---|
| `--design-sepia-soft` | `30 30% 50%` | The italic *(saved)* suffix on a soft-skipped Done row. Lighter than `--design-sepia` so it whispers next to the louder amber pip. |

### Status mapping (hub rows — 5 + 1 states)

| State | Pip | Badge text | Badge bg | Row hover | Row left-rule (2px) | WCAG |
|---|---|---|---|---|---|---|
| Pending | `--design-ink-muted / 0.5` | `--design-ink-muted` | transparent | `--design-mark-soft / 0.6` | none | 4.7 ✓ |
| InProgress | `--design-mark` (with `design-pulse-mark`) | `--design-mark-deep` | `--design-mark-soft` | `--design-mark-soft` | `--design-mark` | 5.1 ✓ |
| Done | `--design-emerald` | `--design-emerald` | transparent | `--design-mark-soft / 0.6` | `--design-emerald` (half-height) | 5.4 ✓ |
| Skipped | `--design-amber` | `--design-sepia` | transparent | `--design-mark-soft / 0.6` | `--design-amber / 0.4` | 4.8 ✓ |
| Skipped (saved) | `--design-amber` | `--design-sepia` + italic *(saved)* in `--design-sepia-soft` | transparent | as above | as above | 4.5 ✓ |
| Failed | `--design-mark-deep` + `⚠` glyph in ink | `--design-mark-deep` | transparent | `--design-paper-warm` | `--design-mark-deep` (3px) | 6.4 ✓ |

### Banner variants

All banners read as editorial marginalia, never OS toasts. Left rule + cream surface + ink body.

| Variant | Left rule (4px) | Surface | Body | Title | Used for |
|---|---|---|---|---|---|
| Info | `--design-rule-strong` | `--design-paper-warm` | `--design-ink` | `--design-ink` (eyebrow caps) | Non-blocking notices, stale-state reconcile |
| Recoverable error | `--design-mark` | `--design-paper` | `--design-ink` | `--design-mark-deep` | Anything with a `Retry` |
| Blocking error | `--design-mark-deep` (4px) + `⚠` | `--design-paper-warm` | `--design-ink` | `--design-mark-deep` | Cannot proceed without resolution |

### Don't-use color list

| Temptation | What we use instead |
|---|---|
| A second green for Done | `--design-emerald` already serves; reuse keeps the audit module's vocabulary intact. |
| Loud yellow for Skipped | Amber pip + sepia text; loudness lives in the un-skip affordance, not the badge. |
| Stop-sign red for Failed | `--design-mark-deep` + `⚠` glyph + thicker rule + warm cream. Weight does the alerting, not a new hue. |

---

## 4 · Typography

### Three families

| Family | Role |
|---|---|
| Spectral | Serif headings (`design-heading`) and italic marginalia (`design-marginalia`). |
| Familjen Grotesk | Sans body — default `.design-surface` family, paragraph copy, form labels. |
| JetBrains Mono | Eyebrows, plate codes, button captions, status badges, tabular numerics. |

### Hierarchy

Modular ratio ≈ **1.25**. Spectral 600 for headings; never bold body sans (emphasis = colour or italic).

| Token | Family | Size (rem / px@16) | Line-height | Weight | Tracking | Case | Used in |
|---|---|---|---|---|---|---|---|
| `display` | Spectral | 2.25 / 36 | 1.15 | 600 | -0.012em | — | Hub page title |
| `h1` | Spectral | 1.875 / 30 | 1.18 | 600 | -0.012em | — | Editor primary title |
| `h2` | Spectral | 1.5 / 24 | 1.22 | 600 | -0.012em | — | SAD-confirm summary heading |
| `h3` | Spectral | 1.2 / 19 | 1.30 | 600 | -0.012em | — | Hub row heading, editor sub-titles |
| `h4` | Spectral | 1.0 / 16 | 1.40 | 600 | -0.008em | — | Sub-section labels |
| `body` | Familjen Grotesk | 1.0 / 16 | 1.55 | 400 | -0.005em | — | Default body, form labels |
| `body-dense` | Familjen Grotesk | 0.9 / 14.4 | 1.45 | 400 | -0.003em | — | Hub-row body, secondary form labels |
| `caption` | Familjen Grotesk | 0.78 / 12.5 | 1.40 | 400 | 0 | — | Inline help under inputs |
| `marginalia` | Spectral italic | 0.85 / 13.6 | 1.45 | 400 | — | — | Explanatory notes, banner body, soft-skip suffix |
| `eyebrow-lg` | JetBrains Mono | 0.78 / 12.5 | 1.30 | 500 | 0.18em | UPPER | Hub row "PLATE · 01" |
| `eyebrow` | JetBrains Mono | 0.68 / 10.9 | 1.30 | 500 | 0.16em | UPPER | Section eyebrows |
| `eyebrow-sm` | JetBrains Mono | 0.62 / 9.9 | 1.20 | 600 | 0.18em | UPPER | Status badges |
| `mono-num` | JetBrains Mono | 0.78 / 12.5 | 1.30 | 500 | 0.04em | — | Tabular numerics ("Saved at 14:35", "12 / 47") |
| `code` | JetBrains Mono | 0.85 / 13.6 | 1.55 | 400 | 0 | — | Editor textarea |
| `button-cap` | JetBrains Mono | 0.72 / 11.5 | 1.00 | 500 | 0.10em | UPPER | Button labels |

### Status-badge typography rule

**Always `eyebrow-sm` (mono caps).** Italic Spectral fails at 0.62–0.7rem cap-heights — "Skipped" reads as a typo. Mono caps with 0.18em tracking match the rest of the system's "system label" vocabulary.

The **soft-skip "(saved)" suffix** is the one exception — italic Spectral in `--design-sepia-soft`, because it IS prose ("Skipped, but saved") rather than a status identifier.

### Numeric formatting

All times, counts, and quantities render in `mono-num` with `font-feature-settings: "tnum" 1, "ss05"` (tabular figures + slashed-zero variant from JetBrains Mono). This keeps `14:35` and `21:08` column-aligned across hub rows.

### Hub-row density

Three vertical lines per row — eyebrow / heading / marginalia — with multiplicative spacing.

| Element | Style | Margin-top |
|---|---|---|
| Eyebrow (`PLATE · 01`) | `eyebrow-lg` | 0 |
| Heading (`Logical · What & Why`) | `h3` | 0.15rem |
| Marginalia (explainer) | `marginalia` | 0.25rem |
| Vertical padding | — | 0.85rem top, 0.95rem bottom |
| Row min-height | populated 94px / collapsed 76px | — |
| Inter-row hairline | `hsl(var(--design-rule) / 0.55)` | — |

### Truncation rules

| Element | Rule |
|---|---|
| Confluence page title | Single line, ellipsis |
| Banner error reason | 2-line clamp |
| Session name in cartouche | Single line, ellipsis at 9rem |
| Hub row heading | Single line, ellipsis |
| Hub row marginalia | 2-line clamp; full text on hover via `title` |
| `Saved at HH:MM · Edited` | Never truncate; drop "· Edited" suffix first if width-constrained |

### Don't-use type list

| Anti-pattern | What to do instead |
|---|---|
| Italic Spectral for status badges | `eyebrow-sm` (mono caps). |
| Familjen Grotesk regular for eyebrows | Always JetBrains Mono caps with ≥0.16em tracking. |
| Bold weights for body emphasis | Use `--design-mark-deep` colour or italic Spectral. Body stays at 400. |

---

## 5 · Component vocabulary

### Existing classes — already in `src/styles/design-theme.css`

| Class | Purpose |
|---|---|
| `design-surface` | Outer wrapper. Loads parchment background, cyanotype grid, base type. |
| `design-plate` | Hairline-bordered inset card. `design-plate--mark` adds a crimson top rule. |
| `design-eyebrow` | JetBrains Mono caps section markers. |
| `design-heading` | Spectral serif heading. |
| `design-marginalia` | Italic Spectral sepia explanatory note. |
| `design-mono` | JetBrains Mono inline. |
| `design-cartouche` | The bordered title-block signature element. |
| `design-btn-mark` | Primary crimson stamp button. |
| `design-btn-ghost` | Secondary outlined button. |
| `design-tab` | Plate-tab strip (used by PhaseSwitcher and the Draw.io / Lucid sub-tab). |
| `design-row` | Selectable list row with crimson left-rule on `data-active="true"`. |
| `design-rise` | Single staggered entrance animation. |
| `design-stagger` | Apply rise to children with cascading delay. |
| `design-resize-handle` | Hairline column-resize handle for `react-resizable-panels`. |
| `design-dot` + `--green/amber/red/muted` | Status pip variants. |
| `design-pulse-mark` | Pulsing crimson glow keyframe — used for InProgress pips. |
| `design-hint-dismiss` | Wax-seal × button for one-time help banners. |
| `design-bubble-user` / `design-bubble-assistant` | SAD chat bubbles. |
| `design-chat-input` | Cream-on-cream input/textarea with crimson focus ring. |
| `design-table` | Drafting-tabular table. |

### New classes added by the SAD redesign

| Class | Purpose |
|---|---|
| `design-btn-link` | Text-only crimson link button (existing `<a>` styling codified). Used for "Fix this →", "Open logs", inline secondary actions where a button border would be too heavy. |
| `design-status-badge` | Mono-caps badge with `data-state="pending\|in_progress\|done\|skipped\|skipped_saved\|failed"`. Carries the status mapping from §3. |
| `design-banner` | Editorial banner with `data-variant="info\|recoverable\|blocking"`. 4px left rule, cream surface, ink body. |
| `design-row-status` | Hub row container — three vertical lines + actions cluster + optional left-rule. Carries the density spec from §4. |

---

## 6 · Interaction rules (visual implications)

These are the rules from Stages 5–6 that constrain the visual layer. The full state machine and error-recovery copy live in the design docs; this section captures only what affects how things render.

- **State is the receipt.** Saving / skipping flips the hub row's `data-state` immediately. No toast layer.
- **Skip is a labelled, reversible button** on every Pending row. Soft-skip on a Done row preserves the artifact and renders an italic *(saved)* suffix in `--design-sepia-soft` next to the Skipped badge.
- **Reopen never destroys.** Reopening a Done diagram loads the saved artifact; closing the editor without saving restores the prior `data-state` exactly.
- **Mid-edit Generate-SAD attempt** is blocked **inline at the in-progress row** with a recoverable banner above it. Never via modal.
- **All errors render via `design-banner`** (inline, row-level, or page-level — never an OS toast or popup). Modals only for destructive confirmations.
- **Keyboard model** —
  - Hub: Tab cycles rows; Enter activates primary action; Shift+Enter activates secondary; ⌘/Ctrl+G activates `Generate SAD`.
  - Editor: Esc closes (with dirty warning); ⌘/Ctrl+S saves; ⌘/Ctrl+Enter saves & closes.
- **Aria-live polite region** in the hub footer announces every status change as a full sentence ("Logical diagram saved at 14:35", "Infrastructure skipped — you can un-skip from the same row"). Status badges carry the same prose in `aria-label`.
- **Focus discipline** —
  - Editor close → focus returns to the row that was opened.
  - SAD-confirm cancel → focus returns to the `Generate SAD` button.
  - Failed banner dismiss → focus moves to whichever slot can still proceed.

---

## 7 · Out of scope for this system

- **Backend storage details.** Per-type S3 slots and DB columns are a follow-on ticket. Frontend models the abstraction via a `useDiagramSlots` hook and may use localStorage as a temporary mock.
- **Plates 01–10 (SAD specification phase).** Already built. Not redesigned.
- **Authentication, project selection, session sidebar.** Already implemented. Outside this work's scope.
- **Versioning of L/I/S within a session.** Each slot stores one diagram. No version history beyond the existing 5-deep `previous_versions` stack inherited from the SAD section editor.

---

## 8 · Open questions / assumptions to validate

1. **Engineers consider Skip an honest answer.** They won't fake-generate just to clear a Pending status. — to be validated in usability testing.
2. **The diagram→section mapping displayed at the hub is sufficient context.** Users won't need a separate explainer or onboarding. — validate.
3. **Three slots per session is enough.** Nobody needs versioning of L/I/S within a session. If wrong, slot-level history will need design.

---

*This file is the persistence layer. Update it when a new pattern is introduced or an existing one shifts. Last updated by Stage 9 of the SAD-redesign engagement.*
