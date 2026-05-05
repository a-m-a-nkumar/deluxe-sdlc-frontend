/**
 * DiagramHubRow — one of three rows on the diagram hub.
 *
 * Canonical Velox stat-card vocabulary (`.usage-stat-card`, `.usage-card-soft`,
 * `.usage-section-mark`, `.usage-ghost-icon`). Each row is a presentation of
 * "this diagram's slot in the SAD" — a numbered section mark, status badge,
 * heading, marginalia explainer, and the trust-contract footer mapping the
 * row to its SAD section.
 *
 * Action cluster on the right collapses behavior by status:
 *   pending        → [Generate] [Skip]
 *   in_progress    → [Resume]   [Skip]   (Skip closes-and-skips)
 *   done           → [Reopen]   [Skip]
 *   skipped        → [Generate now]  [Mark pending]
 *   skipped_saved  → [Reopen]   [Un-skip]
 *   failed         → [Retry]    [Discard]
 */

import {
  CheckCheck,
  Pencil,
  RefreshCcw,
  Shield,
  Server,
  Wand2,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import {
  TYPE_LABEL,
  type DiagramSlot,
  type DiagramType,
} from "@/hooks/useDiagramSlots";

interface Props {
  type: DiagramType;
  slot: DiagramSlot;
  sectionNumber: number;
  onOpen: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  /** Disables interaction — used when an unrelated row is editing or
   *  generation is in flight. */
  disabled?: boolean;
}

const TYPE_ICON: Record<DiagramType, typeof Workflow> = {
  logical: Workflow,
  infrastructure: Server,
  security: Shield,
};

const formatSaved = (epochMs: number) => {
  const d = new Date(epochMs);
  const today = new Date();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  if (d.toDateString() === today.toDateString()) return `Saved at ${time}`;
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
  return `Saved ${day} · ${time}`;
};

export const DiagramHubRow = ({
  type,
  slot,
  sectionNumber,
  onOpen,
  onSkip,
  onUnskip,
  onRetry,
  onDiscard,
  disabled,
}: Props) => {
  const label = TYPE_LABEL[type];
  const Icon = TYPE_ICON[type];
  const status = slot.status;

  return (
    <div
      className="usage-stat-card usage-card-soft relative isolate overflow-hidden rounded-lg border border-border bg-card p-5"
      data-state={status}
      role="group"
      aria-labelledby={`hub-row-${type}-title`}
    >
      {/* numbered section mark — canonical Velox eyebrow */}
      <div className="usage-section-mark mb-3">
        <span className="usage-section-num">{label.num}</span>
        <span>{label.eyebrow}</span>
      </div>

      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex-1 min-w-0">
          <h3
            id={`hub-row-${type}-title`}
            className="text-lg font-semibold text-[hsl(var(--ink-body))] leading-tight"
          >
            {label.title}
          </h3>
          <p
            className="text-sm text-[hsl(var(--ink-muted))] mt-1 leading-relaxed max-w-2xl"
            title={label.marginalia}
          >
            {label.marginalia}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--ink-muted))]">
            <span aria-label={`Lands in SAD section ${sectionNumber}`}>
              → Lands in SAD §{sectionNumber}
            </span>
            {status === "done" && slot.savedAt && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="tabular-nums">
                  {formatSaved(slot.savedAt)}
                  {slot.edited && " · Edited"}
                </span>
              </>
            )}
            {status === "skipped" && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span>Will be a placeholder</span>
              </>
            )}
            {status === "skipped_saved" && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span>Saved diagram retained, excluded from this SAD</span>
              </>
            )}
            {status === "in_progress" && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="text-[hsl(var(--primary))] font-medium">Editing…</span>
              </>
            )}
            {status === "failed" && slot.error && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="text-destructive font-medium" title={slot.error}>
                  Failed
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <StatusBadge
            state={status}
            contextLabel={type.charAt(0).toUpperCase() + type.slice(1)}
            savedAt={slot.savedAt}
          />

          <div className="flex items-center gap-2">
            {(status === "pending" || status === "in_progress") && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpen}
                  disabled={disabled}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  {status === "pending" ? "Generate" : "Resume"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSkip}
                  disabled={disabled}
                >
                  Skip
                </Button>
              </>
            )}

            {status === "done" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpen}
                  disabled={disabled}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Reopen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSkip}
                  disabled={disabled}
                >
                  Skip
                </Button>
              </>
            )}

            {status === "skipped" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpen}
                  disabled={disabled}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  Generate now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnskip}
                  disabled={disabled}
                >
                  Mark pending
                </Button>
              </>
            )}

            {status === "skipped_saved" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpen}
                  disabled={disabled}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Reopen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnskip}
                  disabled={disabled}
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                  Un-skip
                </Button>
              </>
            )}

            {status === "failed" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onRetry ?? onOpen}
                  disabled={disabled}
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
                {onDiscard && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDiscard}
                    disabled={disabled}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Discard
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Decorative ghost icon — canonical Velox stat-card flourish */}
      <Icon className="usage-ghost-icon w-24 h-24" aria-hidden />
    </div>
  );
};
