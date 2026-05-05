/**
 * PhaseSwitcher — the phase tabs at the top of the Design Assistant.
 *
 *   ┌──── Diagrams ────────  Architecture document ────────────────────┐
 *   │                                                                  │
 *   │                                  Session · name  ·  Stage · …    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The "Architecture document" tab is gated by stage: it stays disabled
 * until the user has walked through the hub footer's "Continue to SAD"
 * button.
 *
 * The Skip-Diagram and Continue-to-SAD buttons used to live here, but
 * the redesigned hub now owns both flows: per-row Skip on each diagram
 * row, plus a single "Continue to SAD →" button in the hub's footer.
 */

import { Layers, FileText } from "lucide-react";
import type { DesignStage } from "@/services/designSessionApi";

export type DesignPhase = "diagram" | "sad";

interface Props {
  phase: DesignPhase;
  stage: DesignStage;
  onPhaseChange: (next: DesignPhase) => void;
  /** Short, all-caps session label rendered in the right rail. */
  sessionLabel: string;
  /** Pretty stage label rendered in the right rail. */
  stageLabel: string;
}

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
    <div className="flex items-center justify-between gap-4 px-4 pt-3 pb-0 border-b border-border">
      <div className="flex items-end gap-1">
        <button
          type="button"
          className="design-tab"
          data-active={phase === "diagram"}
          onClick={() => onPhaseChange("diagram")}
        >
          <Layers className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          Diagrams
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
          Architecture document
        </button>
      </div>

      <div className="flex items-center gap-3 pb-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-[hsl(var(--ink-muted))]">
        <span>
          <span className="text-[hsl(var(--ink-muted))]">Session · </span>
          <span className="text-[hsl(var(--ink-body))]">{sessionLabel}</span>
        </span>
        <span className="text-[hsl(var(--primary))]" aria-hidden>·</span>
        <span>
          <span className="text-[hsl(var(--ink-muted))]">Stage · </span>
          <span className="text-[hsl(var(--ink-body))]">{stageLabel}</span>
        </span>
      </div>
    </div>
  );
}
