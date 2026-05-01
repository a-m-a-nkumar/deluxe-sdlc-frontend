/**
 * PhaseSwitcher — the plate selector.
 *
 *   ┌──── Plate 00 ─── DRAWING ────  Plate 01–10 ─── SPECIFICATION ────┐
 *   │                                                                  │
 *   │  DRAWN · session-name   ⌁   STAGE · DIAGRAM_READY                │
 *   │                                                       [continue] │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The SAD tab is gated by stage: it stays disabled until the user has
 * either saved a diagram or explicitly skipped that step. The cartouche
 * in the right rail is the module's signature element — it makes
 * "where am I in this drafting?" answerable at a glance.
 */

import { ChevronRight, Layers, FileText } from "lucide-react";
import type { DesignStage } from "@/services/designSessionApi";
import { Cartouche } from "./Cartouche";

export type DesignPhase = "diagram" | "sad";

interface Props {
  phase: DesignPhase;
  stage: DesignStage;
  onPhaseChange: (next: DesignPhase) => void;
  onContinueToSad?: () => void;
  onSkipDiagram?: () => void;
  /** Short, all-caps session label rendered in the cartouche. */
  sessionLabel: string;
  /** Pretty stage label rendered in the cartouche. */
  stageLabel: string;
}

const sadPhaseUnlocked = (s: DesignStage): boolean =>
  s !== "NEW" && s !== "DIAGRAM_GATHERING";

export function PhaseSwitcher({
  phase,
  stage,
  onPhaseChange,
  onContinueToSad,
  onSkipDiagram,
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
          title={sadEnabled ? undefined : "Save the diagram (or skip it) to unlock the SAD plates"}
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
        {phase === "diagram" && stage === "DIAGRAM_READY" && onContinueToSad && (
          <button type="button" className="design-btn-mark" onClick={onContinueToSad}>
            Continue to SAD
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        {phase === "diagram" && stage === "NEW" && onSkipDiagram && (
          <button type="button" className="design-btn-ghost" onClick={onSkipDiagram}>
            Skip diagram
          </button>
        )}
      </div>
    </div>
  );
}
