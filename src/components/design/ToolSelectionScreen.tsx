/**
 * ToolSelectionScreen — one-time picker between Draw.io and Lucidchart.
 *
 * Per P4 ("One decision per surface"), this is its own screen. It renders
 * before the hub when `session.tool` is null, and is reachable later via
 * the hub footer's `Change tool` link.
 *
 * Two large stat-card style plates side-by-side. Whole-card click target.
 * ↑/↓ navigate as a radio group. Selection writes through useDiagramSlots
 * and the parent advances to the hub.
 */

import { useEffect, useRef } from "react";
import { ArrowRight, Layers, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthoringTool } from "@/hooks/useDiagramSlots";

interface ToolOption {
  key: AuthoringTool;
  num: string;
  eyebrow: string;
  title: string;
  body: string;
  bestFor: string;
  Icon: typeof Layers;
}

const OPTIONS: ToolOption[] = [
  {
    key: "drawio",
    num: "01",
    eyebrow: "Hand-edited",
    title: "Draw.io",
    body: "Hand-edited diagrams in the embedded editor. Best for tight control over layout and the AWS-icon vocabulary.",
    bestFor: "Architects · Reviewers",
    Icon: Layers,
  },
  {
    key: "lucid",
    num: "02",
    eyebrow: "AI-assisted",
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
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-6 py-12">
          {/* Page header */}
          <div className="usage-section-mark mb-2">
            <span className="usage-section-num">00</span>
            <span>Authoring tool</span>
          </div>
          <h1 className="usage-num-display text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--ink-body))]">
            Choose your authoring tool
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--ink-muted))] max-w-2xl leading-relaxed">
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
                    "usage-stat-card usage-card-soft relative isolate overflow-hidden",
                    "rounded-lg border border-border bg-card text-left p-6 transition-all",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isCurrent && "border-[hsl(var(--primary)/0.5)]",
                  )}
                  style={{ minHeight: "320px" }}
                  onClick={() => onSelect(opt.key)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                >
                  <div className="usage-section-mark mb-4 relative z-10">
                    <span className="usage-section-num">{opt.num}</span>
                    <span>{opt.eyebrow}</span>
                  </div>

                  <h2 className="usage-num-display text-3xl font-bold tracking-tight text-[hsl(var(--ink-body))] mb-2 relative z-10">
                    {opt.title}
                  </h2>

                  <p className="text-base leading-relaxed text-[hsl(var(--ink-muted))] mb-6 relative z-10">
                    {opt.body}
                  </p>

                  <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[hsl(var(--ink-muted))] mb-6 relative z-10">
                    Best for · {opt.bestFor}
                  </div>

                  <div className="flex items-center justify-between relative z-10">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))]">
                      Continue with {opt.title}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[hsl(var(--audit-pass))]">
                        Current choice
                      </span>
                    )}
                  </div>

                  <Icon className="usage-ghost-icon w-28 h-28" aria-hidden />
                </button>
              );
            })}
          </div>

          <p className="text-center mt-6 text-sm text-[hsl(var(--ink-muted))]">
            You can switch tools later from the hub.
          </p>

          {onCancel && (
            <div className="text-center mt-8">
              <Button variant="link" onClick={onCancel}>
                ← Back to hub
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
