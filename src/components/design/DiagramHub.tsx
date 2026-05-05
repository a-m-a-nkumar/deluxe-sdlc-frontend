/**
 * DiagramHub — the centrepiece screen of the redesign.
 *
 * Three rows (Logical / Infrastructure / Security) showing per-type slot
 * status, with row-level Generate/Skip/Reopen actions and a footer that
 * gates `Continue to SAD →` based on aggregate state. The aria-live region
 * in the footer announces every status change as a full sentence so
 * screen-readers hear the receipt P1 demands.
 *
 * Canonical Velox vocabulary: numbered section-mark, gradient hero
 * heading, stat-card rows, shadcn buttons. Same register as the
 * Organization Usage page.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "./Banner";
import { DiagramHubRow } from "./DiagramHubRow";
import {
  DIAGRAM_TYPE_ORDER,
  TYPE_LABEL,
  type AuthoringTool,
  type DiagramType,
  type UseDiagramSlots,
} from "@/hooks/useDiagramSlots";

interface Props {
  slots: UseDiagramSlots;
  /** When non-null, hub is in a "blocked because of in-progress edits" state.
   *  We render an inline banner explaining and let the user re-enter the
   *  in-flight editor. */
  blockedByInProgress?: DiagramType[];
  onOpenEditor: (type: DiagramType) => void;
  onGenerateSad: () => void;
  onChangeTool: () => void;
}

const TOOL_LABEL: Record<AuthoringTool, string> = {
  drawio: "Draw.io",
  lucid: "Lucidchart",
};

export const DiagramHub = ({
  slots,
  blockedByInProgress,
  onOpenEditor,
  onGenerateSad,
  onChangeTool,
}: Props) => {
  const [liveMessage, setLiveMessage] = useState("");
  const lastStatusRef = useRef<Record<DiagramType, string>>({
    logical: slots.slot("logical").status,
    infrastructure: slots.slot("infrastructure").status,
    security: slots.slot("security").status,
  });

  // Watch each slot for status transitions and announce them politely. The
  // hub itself doesn't show toasts — this only feeds the screen-reader
  // receipt that pairs with the visible badge change.
  useEffect(() => {
    DIAGRAM_TYPE_ORDER.forEach((t) => {
      const cur = slots.slot(t).status;
      const prev = lastStatusRef.current[t];
      if (prev !== cur) {
        const subject = TYPE_LABEL[t].title.split(" · ")[0];
        const phrases: Record<string, string> = {
          done: `${subject} diagram saved.`,
          skipped: `${subject} diagram skipped — un-skip from the same row.`,
          skipped_saved: `${subject} skipped from this SAD; saved diagram preserved.`,
          in_progress: `Editing ${subject} diagram.`,
          pending: `${subject} diagram returned to pending.`,
          failed: `${subject} diagram failed — see banner above.`,
        };
        setLiveMessage(phrases[cur] ?? "");
        lastStatusRef.current[t] = cur;
      }
    });
  }, [slots]);

  // Keyboard ⌘/Ctrl+G triggers Generate SAD when allowed.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        if (!slots.anyInProgress && slots.hasAnyTerminal) {
          e.preventDefault();
          onGenerateSad();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slots.anyInProgress, slots.hasAnyTerminal, onGenerateSad]);

  const generateDisabled = slots.anyInProgress || !slots.hasAnyTerminal;
  const generateHint = slots.anyInProgress
    ? "Save or close the diagram you're editing first."
    : !slots.hasAnyTerminal
    ? "Generate or skip at least one diagram first."
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* ── Header strip ── */}
      <div className="px-6 py-6 border-b border-border">
        <div className="usage-section-mark mb-2">
          <span className="usage-section-num">00</span>
          <span>Drawing</span>
        </div>
        <h1 className="usage-num-display text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--ink-body))]">
          Architecture diagrams
        </h1>
        <p className="mt-2 text-sm text-[hsl(var(--ink-muted))] max-w-2xl leading-relaxed">
          Author up to three views of the same system. Each one lands in its
          own section of the architecture document — never substituted for
          another.
        </p>
      </div>

      {/* ── Body — rows + (optional) blocking banner ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-4">
          {blockedByInProgress && blockedByInProgress.length > 0 && (
            <Banner
              variant="recoverable"
              title="Save your edits before generating"
            >
              You have {blockedByInProgress.length === 1
                ? "an unsaved diagram open"
                : `${blockedByInProgress.length} diagrams currently being edited`}.
              Save or close before generating the architecture document —{" "}
              {blockedByInProgress.map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 align-baseline"
                    onClick={() => onOpenEditor(t)}
                  >
                    open {TYPE_LABEL[t].title.split(" · ")[0]} →
                  </Button>
                </span>
              ))}
              .
            </Banner>
          )}

          {DIAGRAM_TYPE_ORDER.map((t) => (
            <DiagramHubRow
              key={t}
              type={t}
              slot={slots.slot(t)}
              sectionNumber={slots.sectionFor(t)}
              onOpen={() => onOpenEditor(t)}
              onSkip={() => slots.skip(t)}
              onUnskip={() => slots.unskip(t)}
              onRetry={() => onOpenEditor(t)}
              onDiscard={() => slots.unskip(t)}
              disabled={
                slots.anyInProgress &&
                slots.slot(t).status !== "in_progress"
              }
            />
          ))}
        </div>
      </div>

      {/* ── Footer strip ── */}
      <div className="px-6 py-3 border-t border-border bg-card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="usage-eyebrow">
            Tool · {slots.state.tool ? TOOL_LABEL[slots.state.tool] : "—"}
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onChangeTool}
          >
            Change tool
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {generateHint && (
            <span
              className="text-xs text-[hsl(var(--ink-muted))] max-w-[22rem]"
              aria-hidden
            >
              {generateHint}
            </span>
          )}
          <Button
            variant="default"
            disabled={generateDisabled}
            onClick={onGenerateSad}
            title={generateHint ?? undefined}
            className="transition-all hover:shadow-md"
          >
            Continue to SAD
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>

        {/* aria-live receipt — invisible, polite */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveMessage}
        </div>
      </div>
    </div>
  );
};
