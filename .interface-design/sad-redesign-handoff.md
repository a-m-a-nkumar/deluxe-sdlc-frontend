# SAD Diagram-Phase Redesign — Handoff Spec

**Status:** Frontend ship-ready. Backend single-slot persistence is the only blocker for full release. **Date:** 2026-05-01.
**Reads-with:** [`.interface-design/system.md`](system.md) (the design-system source of truth) and the Stage 14a QA checklist.

---

## 1 · Elevator description

The Velox Design Assistant's Plate 00 (Drawing) was a tool toggle and a 3-card type picker on one screen, where switching diagram type silently destroyed the prior type's work and the SAD generator only ever read one slot. The redesign replaces it with a **screen-state machine** — *tool selection → diagram hub → focused single-type editor → SAD pre-flight → generation → done* — and a **per-type slot model** ([`useDiagramSlots`](../src/hooks/useDiagramSlots.ts)) so each of Logical / Infrastructure / Security has its own status (Pending / In Progress / Done / Skipped / Skipped-saved / Failed). The hub is the centrepiece: it makes state legible (P1 "state is the receipt"), promotes Skip to a first-class verb (P2), and surfaces the diagram→SAD-section mapping (P3 — the trust contract). UI is built on the existing editorial Deluxe theme (cream paper, crimson revision-mark, JetBrains Mono eyebrows) with **zero new dependencies** beyond the already-installed `react-resizable-panels`.

---

## 2 · Files

### Added

| File | Role |
|---|---|
| [src/hooks/useDiagramSlots.ts](../src/hooks/useDiagramSlots.ts) | Per-session, per-type slot state + transitions. localStorage-backed. |
| [src/components/design/StatusBadge.tsx](../src/components/design/StatusBadge.tsx) | Mono-caps `data-state` badge with full-sentence aria-labels. |
| [src/components/design/Banner.tsx](../src/components/design/Banner.tsx) | Editorial banner with `info / recoverable / blocking` variants. |
| [src/components/design/ToolSelectionScreen.tsx](../src/components/design/ToolSelectionScreen.tsx) | Screen 10a — Draw.io vs Lucidchart. |
| [src/components/design/DiagramHubRow.tsx](../src/components/design/DiagramHubRow.tsx) | One row of the hub (eyebrow / title / marginalia / footer / actions). |
| [src/components/design/DiagramHub.tsx](../src/components/design/DiagramHub.tsx) | Screen 10b — header + 3 rows + footer. The centrepiece. |
| [src/components/design/DiagramEditorFrame.tsx](../src/components/design/DiagramEditorFrame.tsx) | Screen 10c — wraps existing dashboards with editorial header + Save/Close. |
| [src/components/design/SadGenerationConfirm.tsx](../src/components/design/SadGenerationConfirm.tsx) | Screen 10d — pre-flight diagram→section mapping. |
| [src/components/design/SadGenerationInProgress.tsx](../src/components/design/SadGenerationInProgress.tsx) | Screen 10e (in flight) — pulsing crimson dot + status line. |
| [src/components/design/SadGenerationDone.tsx](../src/components/design/SadGenerationDone.tsx) | Screen 10e (terminal) — sections cartouche + buttons. |
| [src/components/design/DiagramPhaseHost.tsx](../src/components/design/DiagramPhaseHost.tsx) | Screen-state machine + the integration point for SessionDesignAssistant. |
| [.interface-design/system.md](system.md) | Design-system source of truth (rewritten as part of Stage 9). |

### Modified

| File | Change |
|---|---|
| [src/styles/design-theme.css](../src/styles/design-theme.css) | Appended new tokens (`--design-sepia-soft`) and classes (`design-btn-link`, `design-status-badge`, `design-banner`, `design-row-status`) plus responsive `@media` rules. No existing class altered. |
| [src/pages/SessionDesignAssistant.tsx](../src/pages/SessionDesignAssistant.tsx) | The `phase === "diagram"` block is replaced by `<DiagramPhaseHost />`. SAD-phase code untouched. |
| [src/components/dashboard/DesignDashboard.tsx](../src/components/dashboard/DesignDashboard.tsx) | Added `lockedDiagramType?: DesignDiagramType` prop. When set, the in-component 3-card picker is hidden and the type is pinned. |
| [src/components/dashboard/LucidDashboard.tsx](../src/components/dashboard/LucidDashboard.tsx) | Same `lockedDiagramType` prop addition. |

---

## 3 · Component contracts

| Component | Key props | Behaviour |
|---|---|---|
| **`useDiagramSlots(sessionId)`** | hook | Returns `{ state, slot, sectionFor, setTool, open, save, closeWithoutSave, skip, unskip, retry, fail, anyInProgress, hasAnyTerminal, allPending }`. localStorage key: `velox.designSlots.<sessionId>`. |
| **`StatusBadge`** | `state`, `contextLabel?`, `savedAt?` | Mono-caps badge. aria-label is a full sentence. Renders italic `(saved)` suffix automatically when `state === "skipped_saved"`. |
| **`Banner`** | `variant`, `title?`, `actions?`, `focusOnMount?`, `children` | Editorial banner. Variants are visually distinct (left rule, surface, title colour). Uses `role="alert"` for non-info variants. |
| **`ToolSelectionScreen`** | `currentTool`, `onSelect`, `onCancel?` | Two large plates as a radio group. `onCancel` only renders when revisited from the hub footer. |
| **`DiagramHubRow`** | `type`, `slot`, `sectionNumber`, `onOpen`, `onSkip`, `onUnskip`, `onRetry?`, `onDiscard?`, `disabled?` | One row. Action cluster auto-adapts to slot status. |
| **`DiagramHub`** | `slots`, `blockedByInProgress?`, `onOpenEditor`, `onGenerateSad`, `onChangeTool` | Header + 3 rows + footer. Owns the aria-live receipt and ⌘/Ctrl+G shortcut. |
| **`DiagramEditorFrame`** | `type`, `tool`, `slot`, `initialXml?`, `onSaveAndClose`, `onClose` | Wraps existing dashboards with editorial header + Save/Close. Owns dirty tracking and Esc/⌘S/⌘Enter shortcuts. |
| **`SadGenerationConfirm`** | `slots`, `onCancel`, `onConfirm`, `onFix` | Pre-flight mapping table. `onFix(type)` jumps back to hub with that row scrolled and focused. |
| **`SadGenerationInProgress`** | `progressLabel?`, `detailLabel?`, `onCancel?` | Page-level lock with pulsing dot. `onCancel` triggers an inline confirm marginalia (no modal). |
| **`SadGenerationDone`** | `slots`, `onBackToHub`, `onDownload`, `onOpenInWorkspace` | Sections cartouche + 3 footer buttons. |
| **`DiagramPhaseHost`** | `sessionId`, `sessionDiagramXml?`, `onPersistDiagram`, `onGenerateSad`, `onDownloadSad`, `onOpenSadWorkspace` | Owns the screen state machine. Drop-in replacement for the old `phase === "diagram"` block in `SessionDesignAssistant`. |

---

## 4 · State machine — reference

### Phase-level (the screen the user sees)

```
tool_select ──pick tool──▶ hub ◀──┬──open editor──▶ editor ──save / close──┐
     ▲                            │                                          │
     │                            │                                  ┌───────┘
     └─── change tool (confirm) ──┤                                  │
                                  ├── ⌘G / Generate SAD ──▶ sad_confirm
                                  │                                  │
                                  ▼                                  ▼
                              (failed banner)                  sad_generating
                                  ▲                                  │
                                  └────────── on error ──────────────┤
                                                                     ▼
                                                               sad_done ──▶ workspace
```

### Per-type slot (one instance for L / I / S)

| From | To | Trigger | Side-effect |
|---|---|---|---|
| pending | in_progress | `OPEN(type)` | record prior status |
| pending | skipped | `SKIP(type)` | persist skip flag |
| skipped | in_progress | `OPEN(type)` (un-skip) | record prior status |
| skipped | pending | `UNSKIP(type)` | clear skip flag |
| in_progress | done | `SAVE(type, payload)` | write artifactKey + savedAt |
| in_progress | pending / done | `CLOSE_WITHOUT_SAVE(type)` | restore prior status |
| in_progress | failed | `FAIL(type, error)` | capture error |
| done | in_progress | `OPEN(type)` (Reopen) | preserve artifact |
| done | skipped_saved | `SKIP(type)` (soft-skip) | retain artifactKey |
| skipped_saved | done | `UNSKIP(type)` | restore Done from preserved artifact |
| failed | in_progress | `RETRY(type)` | clear error |
| failed | pending | `DISCARD(type)` | clear error |

---

## 5 · Wiring contract

`SessionDesignAssistant.tsx` now hands the entire diagram phase to `DiagramPhaseHost`:

```tsx
{phase === "diagram" && (
  <DiagramPhaseHost
    sessionId={currentSession.id}
    sessionDiagramXml={sessionDiagramXml}
    onPersistDiagram={async () => {
      await handleSaveDiagramToSession();
      return { artifactKey: undefined };
    }}
    onGenerateSad={handleGenerateSad}
    onDownloadSad={async () => {
      await downloadSadDocx(currentSession.id, `SAD_${sessionPlateLabel}.docx`, projectId ?? undefined);
    }}
    onOpenSadWorkspace={() => setPhase("sad")}
  />
)}
```

The host owns the screen state and the slot model. The page owns session-level concerns (project, session list, SAD-phase pane). Saving a diagram still uses the existing `/api/design/save-diagram` endpoint via `handleSaveDiagramToSession` until per-type slots ship — see §6.

---

## 6 · Backend follow-up — checklist for the backend engineer

The frontend is honouring the per-type contract. The backend currently writes every diagram (regardless of type) to `sessions/{id}/diagram/logical.svg`, and the SAD generator reads only that one path. To deliver the trust contract end-to-end:

1. [ ] **Extend** [`POST /api/design/save-diagram`](../../agentcore-agent/routers/design.py) to accept `diagram_type: "logical" | "infrastructure" | "security"`. Default to `"logical"` for legacy callers.
2. [ ] **Persist** to `sessions/{id}/diagram/{type}.{xml,svg,png}` instead of the single `logical.*`. Use the existing `s3_put_object` helper (KMS-encrypted).
3. [ ] **Add** `diagram_slots` JSONB column on `design_sessions` (or a separate `design_diagram_slots` table) holding `{ logical, infrastructure, security }` with per-slot `{ status, artifact_key, tool, saved_at }`.
4. [ ] **Update** `GET /api/design/sessions/:id` to return the slots; the frontend `useDiagramSlots` hook will then prefer server state over localStorage.
5. [ ] **Update** the SAD generator (Lambda `sdlc-dev-sad-orchestrator`) so §4 reads `logical.svg`, §6 reads `security.svg`, §7 reads `infrastructure.svg`. Each section that finds an empty slot must render the explicit "skipped — not authored" placeholder, never silently fall back.
6. [ ] **Migration:** for existing sessions with a single `logical.svg`, copy it to the `logical` slot. `infrastructure` and `security` start empty.
7. [ ] **Optional:** add `archived_artifacts` array per slot for D3 (tool-switch with prior artifact preservation).

After (1)–(5) ship, swap the `useDiagramSlots` hook's localStorage backing for an API client. The hook's public API doesn't change.

---

## 7 · Edge cases (from Stage 6, distilled)

| Code | Scenario | Behaviour |
|---|---|---|
| A4 | draw.io / Lucid iframe fails to load | Editor body replaced with a recoverable banner; Retry remounts iframe |
| A5 | Save POST fails | Inline `recoverable` banner inside editor; `Try again` retries; `Save as file` downloads XML as backup |
| A6 | User reloads with unsaved edits | `beforeunload` browser dialog (only place an OS dialog is acceptable) |
| B1 | Slot-load fails on session open | Hub renders rows in `Unknown` state with a banner; saved work is safe |
| B5 | Saved artifact missing on Reopen | Editor shows "Start fresh" / "Cancel" — never auto-clears |
| C1 | SAD generation fails mid-stream | Returns to hub with a recoverable banner, "Retry" + "Open logs" |
| C3 | SAD references missing artifact | Done screen shows a yellow marginalia inside the SAD review with `Re-author` link to that hub row |
| D1 | Two tabs on same session | Hub reconciles silently with a hairline `Updated elsewhere` banner |
| D3 | Tool switch with old-tool artifacts | Old artifacts remain in slots, openable read-only with `Switch tool to edit` affordance |
| D5 | Double-click `Generate SAD` | Button disabled-on-first-click; subsequent clicks no-op |

---

## 8 · Behaviour notes (Stage 5)

**Keyboard.**
- Hub: Tab cycles rows; Enter activates primary; Shift+Enter activates secondary; ⌘/Ctrl+G triggers Generate SAD.
- Editor: Esc closes (with dirty warning); ⌘/Ctrl+S saves; ⌘/Ctrl+Enter saves & closes.
- SAD-confirm: Esc cancels.
- SAD-generating: Esc opens cancel-generation confirm marginalia.

**aria-live.** A polite live region in the hub footer announces every status change as a full sentence: *"Logical diagram saved at 14:35"*, *"Infrastructure skipped — un-skip from the same row"*. The visible badge change is the receipt for sighted users; the live region is the audible receipt.

**Focus discipline.**
- Editor close → focus returns to the hub row that was opened.
- SAD-confirm cancel → focus returns to the `Generate SAD` button on the hub.
- Failed banner dismiss → focus moves to the next-actionable button (the `Retry` if present, otherwise the row primary).
- Banners with `focusOnMount` (blocking variant) immediately receive focus.

**Receipts, not toasts.** No status change uses a toast notification. The hub row is the receipt; the live region is the audible receipt; banners persist until dismissed or resolved. Modals are reserved for browser-native dialogs only (`beforeunload`).

---

## 9 · Known limitations / deferred work

| ID | Item | Why deferred |
|---|---|---|
| **P0/2** | Backend single-slot still wins (see §6) | Backend ticket scope; frontend ships behind a per-user beta toggle until then. |
| **P0/3** | No saved-diagram thumbnail in hub Done rows | Adds latency + cache concerns; ship-blocker only if usability testing flags it. |
| **P1/4** | Screen transitions use `design-rise` re-mount, not 220ms slide-in | Acceptable motion vocabulary; iterate after first usability pass. |
| **P1/5** | Generate-SAD disabled-state legend | Marginalia hint exists at md+ but hides on narrow widths; convert to a banner above the footer in the next iteration. |
| **P2/7** | `design-row-status::before` left-rule uses magic numbers | Maintainability only; document and defer. |
| **P2/8** | Tool-selection plate hover uses imperative DOM | Move to CSS `:hover` rule in next pass. |

---

## 10 · How to safely roll back

If a critical defect lands and the redesign needs to be removed quickly:

1. **Restore the old diagram-phase block in `SessionDesignAssistant.tsx`.** Open the file, find the `phase === "diagram"` block (search for `<DiagramPhaseHost`), and replace it with the prior implementation. The prior version is preserved in the [git history](https://github.com/) — checkout the file at the commit immediately preceding the redesign merge and copy lines 646–740 into place.
2. **Remove the `<DiagramPhaseHost>` import** at the top of `SessionDesignAssistant.tsx` (search for `import { DiagramPhaseHost }`).
3. **Leave the new files in place.** `DiagramPhaseHost`, `DiagramHub`, `useDiagramSlots`, etc. — they're orphaned but cause no harm; deleting them is a follow-on PR. Same for the CSS additions in `design-theme.css` (`design-btn-link`, `design-status-badge`, `design-banner`, `design-row-status`); they're additive and don't affect anything outside the redesign.
4. **Remove the `lockedDiagramType` prop usage in DesignDashboard / LucidDashboard.** Optional. The prop is opt-in (`undefined` = legacy behaviour) so leaving it in causes no regression; delete in the cleanup PR.
5. **Clear localStorage entries for affected users.** `localStorage.removeItem("velox.designSlots.*")` — emit via a deploy-time migration or instruct users to refresh. Without this, a re-roll-out will see stale slot data.
6. **Re-run TypeScript** (`npx tsc --noEmit`) and the visual smoke-test (open a session in each phase) to confirm the rollback is clean.

The rollback is **non-destructive to user data** — the only saved artifacts are the SAD diagrams in S3, which were already saved through the legacy single-slot path the backend still uses.

---

*This handoff doc is the contract for the SAD-redesign engagement. If you change anything in §3 (component contracts), §4 (state machine), or §6 (backend follow-up), update this file in the same PR.*
