/**
 * SadGenerationDone — terminal screen for the diagram phase.
 *
 * Frames the result as a delivered artifact, not a generic "success." Top
 * cartouche shows per-section status (Done / Skipped) — the same trust
 * contract surfaced at pre-flight, now confirmed in the output.
 *
 * Buttons:
 *   • Back to hub  — returns to the diagram hub (revisit any row)
 *   • Download .docx — triggers existing DOCX export
 *   • Open in workspace — primary; jumps to Plates 01-10 specification phase
 */

import { ArrowLeft, ArrowRight, Download, FileText } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import {
  DIAGRAM_TYPE_ORDER,
  TYPE_LABEL,
  type UseDiagramSlots,
} from "@/hooks/useDiagramSlots";

interface Props {
  slots: UseDiagramSlots;
  onBackToHub: () => void;
  onDownload: () => void | Promise<void>;
  onOpenInWorkspace: () => void;
}

export const SadGenerationDone = ({
  slots,
  onBackToHub,
  onDownload,
  onOpenInWorkspace,
}: Props) => {
  return (
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[820px] mx-auto px-6 py-12 design-stagger">
          <div className="design-eyebrow" style={{ color: "hsl(var(--design-emerald))" }}>
            Specification · Issued
          </div>
          <h1
            className="design-heading mt-1"
            style={{ fontSize: "2.25rem", lineHeight: 1.15 }}
          >
            Software Architecture Document
          </h1>
          <p
            className="design-marginalia mt-2"
            style={{ fontSize: "0.95rem" }}
          >
            All ten plates are drafted. Each diagram-bearing section reads
            from its own slot — placeholders explicit where you skipped.
          </p>

          {/* Sections cartouche — per-type receipt */}
          <div
            className="design-plate p-4 mt-6 flex flex-wrap items-center gap-3"
            style={{ background: "hsl(var(--design-paper-deep))" }}
          >
            <span
              className="design-mono"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "hsl(var(--design-ink-muted))",
              }}
            >
              Sections
            </span>
            <span
              aria-hidden
              style={{ color: "hsl(var(--design-rule))" }}
            >·</span>
            {DIAGRAM_TYPE_ORDER.map((t, i) => {
              const slot = slots.slot(t);
              const subject = TYPE_LABEL[t].title.split(" · ")[0];
              return (
                <span key={t} className="flex items-center gap-2">
                  <span
                    className="design-mono"
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      color: "hsl(var(--design-ink))",
                      fontFeatureSettings: '"tnum" 1, "ss05" 1',
                    }}
                  >
                    §{slots.sectionFor(t)} {subject}
                  </span>
                  <StatusBadge state={slot.status} contextLabel={subject} savedAt={slot.savedAt} />
                  {i < DIAGRAM_TYPE_ORDER.length - 1 && (
                    <span aria-hidden style={{ color: "hsl(var(--design-rule))" }}>·</span>
                  )}
                </span>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 mt-8 flex-wrap">
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onBackToHub}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to hub
            </button>
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onDownload}
            >
              <Download className="w-3.5 h-3.5" />
              Download .docx
            </button>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onOpenInWorkspace}
            >
              <FileText className="w-3.5 h-3.5" />
              Open in workspace
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
