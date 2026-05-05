/**
 * StatusBadge — uppercase status pill driven by SlotStatus.
 *
 * Built on shadcn <Badge> with canonical Velox tokens (no design-* classes).
 * Editorial vocabulary preserved (uppercase + tracking) per system.md §3.
 *
 * Following P1 (state is the receipt) the aria-label is a full sentence so
 * screen readers hear the receipt, not just the word.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SlotStatus } from "@/hooks/useDiagramSlots";

interface Props {
  state: SlotStatus;
  contextLabel?: string;
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

const STATE_CLASSES: Record<SlotStatus, string> = {
  pending:
    "bg-transparent border-border text-[hsl(var(--ink-muted))]",
  in_progress:
    "bg-[hsl(var(--primary)/0.08)] border-[hsl(var(--primary)/0.30)] text-[hsl(var(--primary))]",
  done:
    "bg-[hsl(var(--audit-pass)/0.10)] border-[hsl(var(--audit-pass)/0.35)] text-[hsl(var(--audit-pass))]",
  skipped:
    "bg-transparent border-border text-[hsl(var(--ink-muted))]",
  skipped_saved:
    "bg-transparent border-border text-[hsl(var(--ink-muted))]",
  failed:
    "bg-destructive/10 border-destructive/30 text-destructive",
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
    <Badge
      variant="outline"
      className={cn(
        "uppercase tracking-[0.14em] text-[10px] font-semibold px-2 py-0.5",
        STATE_CLASSES[state],
      )}
      role="status"
      aria-label={ariaSentence(state, contextLabel, savedAt)}
    >
      <span aria-hidden>{LABEL[state]}</span>
      {state === "skipped_saved" && (
        <span className="ml-1 normal-case tracking-normal opacity-70" aria-hidden>(saved)</span>
      )}
    </Badge>
  );
};
