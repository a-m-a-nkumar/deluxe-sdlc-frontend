/**
 * DiagramHubRow — one of three rows on the diagram hub.
 *
 * Renders a `design-row-status` with: eyebrow plate code, status badge,
 * Spectral title, italic marginalia explainer, and a footer line carrying
 * the "→ SAD §N" mapping (the trust contract from P3) plus, when Done,
 * "Saved at HH:MM · Edited" in mono-num.
 *
 * Action cluster on the right collapses behavior by status:
 *   pending        → [Generate] [Skip]
 *   in_progress    → [Resume]   [Skip]      (Skip closes-and-skips)
 *   done           → [Reopen]   [Skip]
 *   skipped        → [Generate now]  [Mark pending]
 *   skipped_saved  → [Reopen]   [Un-skip]
 *   failed         → [Retry]    [Discard]
 */

import { CheckCheck, Pencil, RefreshCcw, Wand2, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { TYPE_LABEL, type DiagramSlot, type DiagramType } from "@/hooks/useDiagramSlots";

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
  const status = slot.status;

  return (
    <div
      className="design-row-status"
      data-state={status}
      role="group"
      aria-labelledby={`hub-row-${type}-title`}
    >
      <div className="design-row-status__eyebrow">{label.plate}</div>

      <div className="design-row-status__badge">
        <StatusBadge
          state={status}
          contextLabel={
            type.charAt(0).toUpperCase() + type.slice(1)
          }
          savedAt={slot.savedAt}
        />
      </div>

      <h3
        id={`hub-row-${type}-title`}
        className="design-row-status__title"
      >
        {label.title}
      </h3>

      <p className="design-row-status__marg" title={label.marginalia}>
        {label.marginalia}
      </p>

      <div className="design-row-status__footer">
        <span aria-label={`Lands in SAD section ${sectionNumber}`}>
          → SAD §{sectionNumber}
        </span>
        {status === "done" && slot.savedAt && (
          <>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span>
              {formatSaved(slot.savedAt)}
              {slot.edited && " · Edited"}
            </span>
          </>
        )}
        {status === "skipped" && (
          <>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontStyle: "italic", fontFamily: "Spectral, Georgia, serif" }}>
              Will be a placeholder
            </span>
          </>
        )}
        {status === "skipped_saved" && (
          <>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontStyle: "italic", fontFamily: "Spectral, Georgia, serif" }}>
              Saved diagram retained, excluded from this SAD
            </span>
          </>
        )}
        {status === "in_progress" && (
          <>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: "hsl(var(--design-mark-deep))" }}>
              Editing…
            </span>
          </>
        )}
        {status === "failed" && slot.error && (
          <>
            <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: "hsl(var(--design-mark-deep))" }} title={slot.error}>
              Failed
            </span>
          </>
        )}
      </div>

      <div className="design-row-status__actions">
        {(status === "pending" || status === "in_progress") && (
          <>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onOpen}
              disabled={disabled}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {status === "pending" ? "Generate" : "Resume"}
            </button>
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onSkip}
              disabled={disabled}
            >
              Skip
            </button>
          </>
        )}

        {status === "done" && (
          <>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onOpen}
              disabled={disabled}
            >
              <Pencil className="w-3.5 h-3.5" />
              Reopen
            </button>
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onSkip}
              disabled={disabled}
            >
              Skip
            </button>
          </>
        )}

        {status === "skipped" && (
          <>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onOpen}
              disabled={disabled}
            >
              <Wand2 className="w-3.5 h-3.5" />
              Generate now
            </button>
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onUnskip}
              disabled={disabled}
            >
              Mark pending
            </button>
          </>
        )}

        {status === "skipped_saved" && (
          <>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onOpen}
              disabled={disabled}
            >
              <Pencil className="w-3.5 h-3.5" />
              Reopen
            </button>
            <button
              type="button"
              className="design-btn-ghost"
              onClick={onUnskip}
              disabled={disabled}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Un-skip
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <button
              type="button"
              className="design-btn-mark"
              onClick={onRetry ?? onOpen}
              disabled={disabled}
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry
            </button>
            {onDiscard && (
              <button
                type="button"
                className="design-btn-ghost"
                onClick={onDiscard}
                disabled={disabled}
              >
                <X className="w-3.5 h-3.5" />
                Discard
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
