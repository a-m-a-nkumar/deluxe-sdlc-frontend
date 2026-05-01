/**
 * DiagramHub — the centrepiece screen of the redesign.
 *
 * Three rows (Logical / Infrastructure / Security) showing per-type slot
 * status, with row-level Generate/Skip/Reopen actions and a footer that
 * gates `Generate SAD →` based on aggregate state. The aria-live region
 * in the footer announces every status change as a full sentence so
 * screen-readers hear the receipt P1 demands.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
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
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      {/* ── Header strip ── */}
      <div
        className="px-6 py-5 border-b design-rise"
        style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
      >
        <div className="design-eyebrow">Plate · 00 — Drawing</div>
        <h1
          className="design-heading mt-1"
          style={{ fontSize: "1.875rem", lineHeight: 1.18 }}
        >
          Architecture diagrams
        </h1>
        <p
          className="design-marginalia mt-1"
          style={{ fontSize: "0.95rem", maxWidth: "44rem" }}
        >
          Author up to three views of the same system. Each one lands in its
          own section of the SAD — never substituted for another.
        </p>
      </div>

      {/* ── Body — rows + (optional) blocking banner ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="design-stagger">
          {blockedByInProgress && blockedByInProgress.length > 0 && (
            <div className="px-6 pt-4">
              <Banner
                variant="recoverable"
                title="Save your edits before generating"
              >
                You have {blockedByInProgress.length === 1
                  ? "an unsaved diagram open"
                  : `${blockedByInProgress.length} diagrams currently being edited`}.
                Save or close before generating the SAD —{" "}
                {blockedByInProgress.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ", "}
                    <button
                      type="button"
                      className="design-btn-link"
                      onClick={() => onOpenEditor(t)}
                    >
                      open {TYPE_LABEL[t].title.split(" · ")[0]} →
                    </button>
                  </span>
                ))}
                .
              </Banner>
            </div>
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
      <div
        className="design-hub-footer px-6 py-3 border-t flex items-center justify-between gap-4"
        style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="design-mono"
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "hsl(var(--design-ink-muted))",
            }}
          >
            Tool · {slots.state.tool ? TOOL_LABEL[slots.state.tool] : "—"}
          </span>
          <button
            type="button"
            className="design-btn-link"
            onClick={onChangeTool}
          >
            Change tool
          </button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {generateHint && (
            <span
              className="design-marginalia"
              style={{ fontSize: "0.78rem", maxWidth: "22rem" }}
              aria-hidden
            >
              {generateHint}
            </span>
          )}
          <button
            type="button"
            className="design-btn-mark"
            disabled={generateDisabled}
            onClick={onGenerateSad}
            title={generateHint ?? undefined}
          >
            Generate SAD
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* aria-live receipt — invisible, polite */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {liveMessage}
        </div>
      </div>
    </div>
  );
};
