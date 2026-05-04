/**
 * PhaseSwitcher — the plate selector.
 *
 *   ┌──── Plate 00 ─── DRAWING ────  Plate 01–10 ─── SPECIFICATION ────┐
 *   │                                                                  │
 *   │                                  SESSION · name  ⌁  STAGE · …    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The SAD tab is gated by stage: it stays disabled until the user has
 * walked through the hub footer's "Continue to SAD" button. The
 * cartouche in the right rail is the module's signature element —
 * it makes "where am I in this drafting?" answerable at a glance.
 *
 * The Skip-Diagram and Continue-to-SAD buttons used to live here, but
 * the redesigned hub now owns both flows: per-row Skip on each diagram
 * row, plus a single "Continue to SAD →" button in the hub's footer.
 * Surfacing the same actions twice was redundant and confused the
 * primary path, so we removed them from this strip.
 */

import { Layers, FileText } from "lucide-react";
import type { DesignStage } from "@/services/designSessionApi";
import { Cartouche } from "./Cartouche";

export type DesignPhase = "diagram" | "sad";

interface Props {
  phase: DesignPhase;
  stage: DesignStage;
  onPhaseChange: (next: DesignPhase) => void;
  /** Short, all-caps session label rendered in the cartouche. */
  sessionLabel: string;
  /** Pretty stage label rendered in the cartouche. */
  stageLabel: string;
}

// SAD tab is unlocked only after the user has explicitly clicked
// "Continue to SAD" on the diagram hub (which advances stage to one of
// the SAD_* states). Saving a diagram alone (which advances to
// DIAGRAM_READY) does NOT unlock the tab — the user must walk through
// the hub footer to reach SAD the first time. After that one-time
// gate, the tab stays clickable for the rest of the session.
const sadPhaseUnlocked = (s: DesignStage): boolean =>
  s === "SAD_GATHERING" || s === "SAD_GENERATING" || s === "SAD_REFINING";

export function PhaseSwitcher({
  phase,
  stage,
  onPhaseChange,
  sessionLabel,
  stageLabel,
}: Props) {
  const sadEnabled = sadPhaseUnlocked(stage);

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 pt-3 pb-0 border-b design-rise"
      style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
    >
      <div className="flex items-end gap-1">
        <button
          type="button"
          className="design-tab"
          data-active={phase === "diagram"}
          onClick={() => onPhaseChange("diagram")}
        >
          <Layers className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          Plate 00 · Drawing
        </button>
        <button
          type="button"
          className="design-tab"
          data-active={phase === "sad" && sadEnabled}
          disabled={!sadEnabled}
          onClick={() => sadEnabled && onPhaseChange("sad")}
          title={
            sadEnabled
              ? undefined
              : "Click Continue to SAD on the diagram hub to unlock this tab"
          }
        >
          <FileText className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          Plates 01–10 · Specification
        </button>
      </div>

      <div className="flex items-center gap-3 pb-2">
        <Cartouche
          fields={[
            { label: "Session", value: sessionLabel },
            { label: "Stage", value: stageLabel },
          ]}
        />
      </div>
    </div>
  );
}
