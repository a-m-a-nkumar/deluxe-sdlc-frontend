/**
 * SadGenerationInProgress — page-level lock during SAD generation.
 *
 * No spinner. The pulsing crimson dot from `design-pulse-mark` is the only
 * motion. The section name in the heading updates as generation advances
 * through plates 01–10.
 *
 * Cancel triggers an inline confirm marginalia (no modal) — Keep generating
 * is the default focus, Cancel anyway is the link button.
 */

import { useEffect, useState } from "react";
import { Banner } from "./Banner";

interface Props {
  /** Optional human-readable progress line (e.g. "Drafting Section 4 — Logical").
   *  When omitted, falls back to a generic phase. */
  progressLabel?: string;
  /** Optional sub-line — totals or remaining work. */
  detailLabel?: string;
  onCancel?: () => void;
}

export const SadGenerationInProgress = ({
  progressLabel,
  detailLabel,
  onCancel,
}: Props) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        setShowCancelConfirm(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className="text-center max-w-[40rem] design-rise"
        >
          <div className="flex justify-center mb-6">
            <span
              className="design-pulse-mark"
              style={{
                width: "1.25rem",
                height: "1.25rem",
                background: "hsl(var(--design-mark))",
              }}
              aria-hidden
            />
          </div>

          <div className="design-eyebrow">SAD · Generating</div>

          <h1
            className="design-heading mt-2"
            style={{ fontSize: "1.5rem", lineHeight: 1.22 }}
            aria-live="polite"
          >
            {progressLabel ?? "Building your Software Architecture Document"}
          </h1>

          <p
            className="design-marginalia mt-3"
            style={{ fontSize: "0.9rem" }}
          >
            {detailLabel ??
              "Reading your diagrams and drafting the ten plates. This usually takes 60 to 120 seconds."}
          </p>

          {showCancelConfirm && onCancel && (
            <div className="mt-6 text-left">
              <Banner
                variant="recoverable"
                title="Cancel generation?"
                actions={
                  <>
                    <button
                      type="button"
                      className="design-btn-ghost"
                      autoFocus
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Keep generating
                    </button>
                    <button
                      type="button"
                      className="design-btn-link"
                      onClick={onCancel}
                    >
                      Cancel anyway
                    </button>
                  </>
                }
              >
                You'll keep your diagrams; only this generation run will be
                cancelled.
              </Banner>
            </div>
          )}

          {!showCancelConfirm && onCancel && (
            <div className="mt-8">
              <button
                type="button"
                className="design-btn-ghost"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel generation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
