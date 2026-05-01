/**
 * StatusBadge — mono-caps status pill driven by `data-state`.
 *
 * The visual language lives in `design-theme.css` under `.design-status-badge`.
 * This component is a thin wrapper that maps SlotStatus to (a) the badge
 * label, (b) the data-state attribute, and (c) the optional italic "(saved)"
 * suffix on a soft-skipped Done row.
 *
 * Following P1 (state is the receipt) the aria-label is a full sentence so
 * screen readers hear the receipt, not just the word.
 */

import type { SlotStatus } from "@/hooks/useDiagramSlots";

interface Props {
  state: SlotStatus;
  /** Human-readable type name, used to compose the aria-label receipt
   *  ("Status: Logical diagram done, last saved 14:35"). */
  contextLabel?: string;
  /** Optional savedAt epoch — used for the aria-label receipt only. */
  savedAt?: number;
}

const LABEL: Record<SlotStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  skipped: "Skipped",
  skipped_saved: "Skipped",
  failed: "Failed",
};

const formatTime = (epochMs: number) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(epochMs));

const formatDate = (epochMs: number) => {
  const d = new Date(epochMs);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `today at ${formatTime(epochMs)}`;
  return new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" }).format(d);
};

const ariaSentence = (state: SlotStatus, ctx?: string, savedAt?: number) => {
  const subject = ctx ? `${ctx} diagram` : "Diagram";
  switch (state) {
    case "pending":      return `Status: ${subject} pending — not yet started.`;
    case "in_progress":  return `Status: ${subject} in progress — currently being authored.`;
    case "done":         return savedAt
      ? `Status: ${subject} done, last saved ${formatDate(savedAt)}.`
      : `Status: ${subject} done.`;
    case "skipped":      return `Status: ${subject} skipped — reversible from the same row.`;
    case "skipped_saved": return savedAt
      ? `Status: ${subject} skipped from this SAD, but the saved diagram from ${formatDate(savedAt)} is preserved.`
      : `Status: ${subject} skipped, saved diagram preserved.`;
    case "failed":       return `Status: ${subject} failed — recoverable, see banner above.`;
  }
};

export const StatusBadge = ({ state, contextLabel, savedAt }: Props) => {
  return (
    <span
      className="design-status-badge"
      data-state={state}
      role="status"
      aria-label={ariaSentence(state, contextLabel, savedAt)}
    >
      <span aria-hidden>{LABEL[state]}</span>
      {state === "skipped_saved" && (
        <span className="design-status-badge__suffix" aria-hidden>(saved)</span>
      )}
    </span>
  );
};
