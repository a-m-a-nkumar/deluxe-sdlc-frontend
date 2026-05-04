/**
 * SadGenerationConfirm — informational hand-off from Diagram phase to SAD phase.
 *
 * Click "Generate SAD" on the hub footer → this screen → the SAD pane.
 * It surfaces the trust contract (P3) — which diagrams will land in
 * which SAD section, and what placeholdered — and then primes the user
 * for what they can do once inside the SAD pane (chat, generate, audit,
 * edit per section, regenerate).
 *
 * NB: clicking the Continue button does NOT start LLM generation here.
 * The SAD pane has its own Generate button so the user can chat with
 * the assistant first, add facts, and only then run generation.
 *
 * Blocking conditions:
 *   • Any slot InProgress → Continue disabled, banner with "Open editor" link
 *   • All slots Pending   → Continue disabled, banner with hint
 *   • All slots Skipped   → allowed, info banner explains placeholder behaviour
 */

import { useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Banner } from "./Banner";
import { StatusBadge } from "./StatusBadge";
import {
  DIAGRAM_TYPE_ORDER,
  TYPE_LABEL,
  type DiagramType,
  type UseDiagramSlots,
} from "@/hooks/useDiagramSlots";

interface Props {
  slots: UseDiagramSlots;
  onCancel: () => void;
  onConfirm: () => void;
  /** Caller jumps back to hub with that row scrolled + focused. */
  onFix: (type: DiagramType) => void;
}

export const SadGenerationConfirm = ({
  slots,
  onCancel,
  onConfirm,
  onFix,
}: Props) => {
  const allSkipped = DIAGRAM_TYPE_ORDER.every((t) => {
    const s = slots.slot(t).status;
    return s === "skipped" || s === "skipped_saved";
  });

  const inProgress = DIAGRAM_TYPE_ORDER.filter(
    (t) => slots.slot(t).status === "in_progress",
  );

  const blocked = inProgress.length > 0 || slots.allPending;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-12 design-stagger">
          <div className="design-eyebrow">SAD · Hand-off</div>
          <h1
            className="design-heading mt-1"
            style={{ fontSize: "1.875rem", lineHeight: 1.18 }}
          >
            Continue to the SAD pane
          </h1>
          <p
            className="design-marginalia mt-2"
            style={{ fontSize: "0.95rem", maxWidth: "44rem" }}
          >
            Take your saved diagrams forward into Plates 01–10 — the SAD
            specification pane — where you can chat with the assistant,
            run generation when you're ready, audit each section, and
            edit content as needed.
          </p>

          {/* ── Blocking banners ── */}
          {inProgress.length > 0 && (
            <div className="mt-6">
              <Banner
                variant="blocking"
                title="Save your edits first"
                focusOnMount
              >
                {inProgress.length === 1
                  ? "You have one diagram still being edited. Save or close it before generating the SAD —"
                  : `You have ${inProgress.length} diagrams still being edited. Save or close each before generating —`}{" "}
                {inProgress.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ", "}
                    <button
                      type="button"
                      className="design-btn-link"
                      onClick={() => onFix(t)}
                    >
                      open {TYPE_LABEL[t].title.split(" · ")[0]} →
                    </button>
                  </span>
                ))}
                .
              </Banner>
            </div>
          )}

          {slots.allPending && inProgress.length === 0 && (
            <div className="mt-6">
              <Banner variant="recoverable" title="Nothing to include yet">
                Generate or skip at least one diagram before producing the SAD.
                Three placeholdered sections wouldn't be useful.
              </Banner>
            </div>
          )}

          {allSkipped && !blocked && (
            <div className="mt-6">
              <Banner
                variant="info"
                title="All diagrams skipped"
              >
                Sections 4, 6, and 7 will all render explicit "skipped"
                placeholders in the SAD. You can author them later from the
                hub and regenerate.
              </Banner>
            </div>
          )}

          {/* ── Mapping plate ── */}
          <div className="design-plate p-5 mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="design-eyebrow">Diagrams · SAD section mapping</div>
              <span
                className="design-marginalia"
                style={{ fontSize: "0.78rem" }}
              >
                The trust contract.
              </span>
            </div>

            <div className="divide-y" style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}>
              {DIAGRAM_TYPE_ORDER.map((t) => {
                const slot = slots.slot(t);
                const section = slots.sectionFor(t);
                const willBeIncluded =
                  slot.status === "done";
                const subject = TYPE_LABEL[t].title.split(" · ")[0];
                return (
                  <div
                    key={t}
                    className="flex items-baseline gap-4 py-3"
                    style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
                  >
                    <span
                      className="design-mono"
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: "hsl(var(--design-ink))",
                        minWidth: "2.5rem",
                        fontFeatureSettings: '"tnum" 1, "ss05" 1',
                      }}
                    >
                      §{section}
                    </span>

                    <div className="flex-1 min-w-0">
                      <h4
                        className="design-heading"
                        style={{
                          fontSize: "1rem",
                          lineHeight: 1.4,
                        }}
                      >
                        {TYPE_LABEL[t].title}
                      </h4>
                      <p
                        className="design-marginalia"
                        style={{
                          fontSize: "0.78rem",
                          marginTop: "0.15rem",
                        }}
                      >
                        {willBeIncluded
                          ? "Will be included from your saved diagram."
                          : slot.status === "skipped" || slot.status === "skipped_saved"
                          ? "Will render an explicit placeholder."
                          : "Will render a placeholder until authored."}
                      </p>
                    </div>

                    <StatusBadge
                      state={slot.status}
                      contextLabel={subject}
                      savedAt={slot.savedAt}
                    />

                    {!willBeIncluded && (
                      <button
                        type="button"
                        className="design-btn-link"
                        onClick={() => onFix(t)}
                      >
                        Fix this →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p
              className="design-marginalia mt-4"
              style={{ fontSize: "0.82rem" }}
            >
              Sections without a saved diagram render an explicit "skipped"
              note in the SAD — never a silent fallback.
            </p>
          </div>

          {/* ── What you can do in the SAD pane ── */}
          <div className="design-plate p-5 mt-6">
            <div className="design-eyebrow mb-3">
              In the SAD pane you can
            </div>
            <ul className="space-y-2.5" style={{ fontSize: "0.88rem" }}>
              <li className="flex items-baseline gap-2">
                <ChevronRight
                  className="w-3 h-3 flex-shrink-0 mt-1"
                  style={{ color: "hsl(var(--design-mark))" }}
                />
                <span>
                  <strong style={{ color: "hsl(var(--design-ink))" }}>
                    Chat with the assistant
                  </strong>{" "}
                  — paste Confluence URLs, upload docs, add facts. The
                  assistant will absorb everything before you run generation.
                </span>
              </li>
              <li className="flex items-baseline gap-2">
                <ChevronRight
                  className="w-3 h-3 flex-shrink-0 mt-1"
                  style={{ color: "hsl(var(--design-mark))" }}
                />
                <span>
                  <strong style={{ color: "hsl(var(--design-ink))" }}>
                    Generate the SAD
                  </strong>{" "}
                  — when ready, click <em>Generate</em> in the SAD pane to
                  draft all 10 plates from your saved diagrams + facts.
                </span>
              </li>
              <li className="flex items-baseline gap-2">
                <ChevronRight
                  className="w-3 h-3 flex-shrink-0 mt-1"
                  style={{ color: "hsl(var(--design-mark))" }}
                />
                <span>
                  <strong style={{ color: "hsl(var(--design-ink))" }}>
                    Audit
                  </strong>{" "}
                  — score each section and surface what's missing or unclear.
                </span>
              </li>
              <li className="flex items-baseline gap-2">
                <ChevronRight
                  className="w-3 h-3 flex-shrink-0 mt-1"
                  style={{ color: "hsl(var(--design-mark))" }}
                />
                <span>
                  <strong style={{ color: "hsl(var(--design-ink))" }}>
                    Edit per section
                  </strong>{" "}
                  — hand-edit, regenerate, or revert any section. Drafts are
                  versioned so a regenerate is always reversible.
                </span>
              </li>
            </ul>
            <p
              className="design-marginalia mt-4"
              style={{ fontSize: "0.82rem" }}
            >
              Continuing now does not start generation. The SAD pane has its
              own Generate button so you can author at your own pace.
            </p>
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onCancel}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              type="button"
              className="design-btn-mark"
              disabled={blocked}
              onClick={onConfirm}
            >
              Continue to SAD
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
