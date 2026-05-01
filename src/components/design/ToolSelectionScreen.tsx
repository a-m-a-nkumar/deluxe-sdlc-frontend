/**
 * ToolSelectionScreen — one-time picker between Draw.io and Lucidchart.
 *
 * Per P4 ("One decision per surface"), this is its own screen. It renders
 * before the hub when `session.tool` is null, and is reachable later via
 * the hub footer's `Change tool` link.
 *
 * Two large editorial plates side-by-side. Whole-card click target. ↑/↓
 * navigate as a radio group. Selection writes through useDiagramSlots and
 * the parent advances to the hub.
 */

import { useEffect, useRef } from "react";
import { ArrowRight, Layers, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthoringTool } from "@/hooks/useDiagramSlots";

interface ToolOption {
  key: AuthoringTool;
  plate: string;
  title: string;
  body: string;
  bestFor: string;
  Icon: typeof Layers;
}

const OPTIONS: ToolOption[] = [
  {
    key: "drawio",
    plate: "Authoring · 01",
    title: "Draw.io",
    body: "Hand-edited diagrams in the embedded editor. Best for tight control over layout and the AWS-icon vocabulary.",
    bestFor: "Architects · Reviewers",
    Icon: Layers,
  },
  {
    key: "lucid",
    plate: "Authoring · 02",
    title: "Lucidchart",
    body: "AI-assisted authoring via Lucid AI's MCP. Best for first-pass speed and a hosted artifact your team can edit further.",
    bestFor: "Speed-first · Drafting",
    Icon: Wand2,
  },
];

interface Props {
  /** Current tool, if any. Used to highlight the previously-selected option
   *  when the user came back via "Change tool". */
  currentTool?: AuthoringTool | null;
  onSelect: (tool: AuthoringTool) => void;
  onCancel?: () => void;
}

export const ToolSelectionScreen = ({ currentTool, onSelect, onCancel }: Props) => {
  const firstRef = useRef<HTMLButtonElement | null>(null);

  // Focus the first plate (or the current tool) on mount.
  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = document.querySelectorAll<HTMLButtonElement>("[data-tool-plate]")[
        (idx + 1) % OPTIONS.length
      ];
      next?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = document.querySelectorAll<HTMLButtonElement>("[data-tool-plate]")[
        (idx - 1 + OPTIONS.length) % OPTIONS.length
      ];
      prev?.focus();
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-6 py-12 design-stagger">
          {/* Page header */}
          <div className="design-eyebrow">Authoring tool · Drawing</div>
          <h1
            className="design-heading mt-1"
            style={{ fontSize: "2.25rem", lineHeight: 1.15 }}
          >
            Choose your authoring tool
          </h1>
          <p
            className="design-marginalia mt-2"
            style={{ fontSize: "0.95rem", maxWidth: "44rem" }}
          >
            Each session uses one tool. You can change it later from the hub —
            previously-saved diagrams stay accessible read-only.
          </p>

          {/* Two plates, side-by-side */}
          <div
            className="grid gap-5 mt-8"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
            role="radiogroup"
            aria-label="Choose an authoring tool"
          >
            {OPTIONS.map((opt, i) => {
              const isCurrent = currentTool === opt.key;
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.key}
                  ref={i === 0 ? firstRef : undefined}
                  data-tool-plate
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  className={cn(
                    "design-plate text-left p-6 transition-colors group",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    isCurrent && "design-plate--mark",
                  )}
                  style={{
                    background: "hsl(var(--design-paper-deep))",
                    minHeight: "320px",
                  }}
                  onClick={() => onSelect(opt.key)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  onMouseEnter={(e) => {
                    e.currentTarget.classList.add("design-plate--mark");
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent)
                      e.currentTarget.classList.remove("design-plate--mark");
                  }}
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="design-eyebrow">{opt.plate}</span>
                    <Icon
                      className="w-5 h-5"
                      style={{
                        color: "hsl(var(--design-ink-soft))",
                      }}
                    />
                  </div>

                  <h2
                    className="design-heading"
                    style={{ fontSize: "1.875rem", lineHeight: 1.18, marginBottom: "0.5rem" }}
                  >
                    {opt.title}
                  </h2>

                  <p
                    style={{
                      fontFamily: "Familjen Grotesk, ui-sans-serif, system-ui, sans-serif",
                      fontSize: "1rem",
                      lineHeight: 1.55,
                      color: "hsl(var(--design-ink-soft))",
                      marginBottom: "1.5rem",
                    }}
                  >
                    {opt.body}
                  </p>

                  <div
                    className="design-mono"
                    style={{
                      fontSize: "0.62rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      color: "hsl(var(--design-ink-muted))",
                      marginBottom: "1.5rem",
                    }}
                  >
                    Best for · {opt.bestFor}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="design-btn-mark">
                      <span>Continue with {opt.title}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    {isCurrent && (
                      <span
                        className="design-mono"
                        style={{
                          fontSize: "0.65rem",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "hsl(var(--design-emerald))",
                        }}
                      >
                        Current choice
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p
            className="design-marginalia text-center mt-6"
            style={{ fontSize: "0.85rem" }}
          >
            You can switch tools later from the hub.
          </p>

          {onCancel && (
            <div className="text-center mt-8">
              <button type="button" className="design-btn-link" onClick={onCancel}>
                ← Back to hub
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
