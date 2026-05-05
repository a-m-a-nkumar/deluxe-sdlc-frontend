/**
 * SADChat — single chat box that powers the SAD phase.
 *
 * Surface treatment per `.interface-design/system.md` §2:
 *   • Tier 2 — panel container uses `--surface-panel` + left `--border-zone`
 *   • Tier 3 — assistant bubbles & cards: `bg-card border border-border shadow-sm`
 *   • User bubble — inverted (`bg-foreground text-background`)
 *   • Tier 2 — input strip wrapped with top `--border-zone`; input itself sits
 *     on `bg-card` to register the form-tier hairline.
 *
 * The component is intentionally dumb: owns input, message list, file attach.
 * All side-effects (regenerate, navigate-to-section, apply-suggestion) bubble
 * up via `onIntent` so the page can re-fetch sections.
 */

import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sadTurn, type SADCard } from "@/services/sadApi";

export interface SADChatBubble {
  id: string;
  role: "user" | "assistant";
  /** For user messages: the typed text. For assistant: card.payload.text or a one-line summary. */
  text?: string;
  card?: SADCard;
}

interface Props {
  sessionId: string;
  projectId: string | null;
  /** The section number the user is currently looking at, if any. Lets the
   * router resolve "fix this" correctly. */
  viewingSection: number | null;
  /** Called whenever an assistant card carries a side-effect that requires the
   * parent to refresh its section view (e.g. section_updated, section_regenerated). */
  onIntent?: (intent: ChatIntent) => void;
  /** Controlled bubble list. Owned by the page so it survives phase
   * (Diagram ↔ SAD) transitions and chat-pane reflow. */
  messages: SADChatBubble[];
  /** Append one bubble to the page-level message store. */
  onAppendMessage: (bubble: SADChatBubble) => void;
}

export type ChatIntent =
  | { kind: "section_changed"; n: number }
  | { kind: "audit_complete" }
  | { kind: "generation_started" }
  | { kind: "facts_changed" };

export function SADChat({
  sessionId,
  projectId,
  viewingSection,
  onIntent,
  messages,
  onAppendMessage,
}: Props) {
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lastCardRef = useRef<SADCard | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // auto-scroll to bottom on new messages
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!sessionId || busy) return;
    const text = input.trim();
    if (!text && !pendingFile) return;

    const userBubble: SADChatBubble = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text || (pendingFile ? `(attached ${pendingFile.name})` : ""),
    };
    onAppendMessage(userBubble);
    setInput("");
    const file = pendingFile;
    setPendingFile(null);
    setBusy(true);

    console.log(
      `[SAD-VIEW] /turn submit → viewing_section=${viewingSection ?? "null"} ` +
        `last_card=${lastCardRef.current?.type ?? "none"} ` +
        `text="${text.slice(0, 60)}${text.length > 60 ? "…" : ""}" ` +
        `file=${file ? file.name : "—"}`,
    );
    try {
      const cards = await sadTurn({
        session_id: sessionId,
        project_id: projectId,
        message: text,
        viewing_section: viewingSection ?? null,
        last_card_type: lastCardRef.current?.type ?? null,
        last_proposed_section:
          (lastCardRef.current?.payload as any)?.suggested_section ??
          (lastCardRef.current?.payload as any)?.n ??
          null,
        file,
      });
      // Iterate cards in order. The backend already arranged them so
      // any auto_regen flag is on the LAST card only — so dispatching
      // intents per-card here doesn't fire multiple regenerations.
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        lastCardRef.current = card;
        onAppendMessage({ id: `a-${Date.now()}-${i}`, role: "assistant", card });
        const t = card.type;
        const p = card.payload as any;
        if ((t === "section_updated" || t === "section_regenerated" || t === "section_view") && p?.n) {
          onIntent?.({ kind: "section_changed", n: p.n });
        } else if (t === "audit") {
          onIntent?.({ kind: "audit_complete" });
        } else if (t === "generation_starting") {
          onIntent?.({ kind: "generation_started" });
        } else if (t === "fact_saved" || t === "doc_ingested") {
          onIntent?.({ kind: "facts_changed" });
          if (t === "doc_ingested" && p?.auto_regen) {
            onIntent?.({ kind: "generation_started" });
          }
        }
      }
    } catch (err) {
      onAppendMessage({
        id: `e-${Date.now()}`,
        role: "assistant",
        text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 bg-[hsl(var(--surface-panel))] border-l border-[hsl(var(--border-zone))]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-2 space-y-3 min-w-0"
      >
        {messages.length === 0 && (
          <div className="px-1 pt-1 text-sm text-[hsl(var(--ink-muted))]">
            Tell me about the architecture, attach supporting docs, or ask
            "what's missing".
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} bubble={m} onIntent={onIntent} sessionId={sessionId} />
        ))}
      </div>
      <div className="border-t border-[hsl(var(--border-zone))] px-3 py-2.5 bg-[hsl(var(--surface-panel))]">
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-card border border-[hsl(var(--primary)/0.4)] text-[hsl(var(--ink-body))] text-xs">
            <Paperclip className="h-3 w-3 text-[hsl(var(--primary))]" />
            <span className="truncate flex-1 font-mono">{pendingFile.name}</span>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              aria-label="Remove file"
              className="text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-body))]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer shrink-0" title="Attach file">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) setPendingFile(f);
              }}
            />
            <span className="inline-flex items-center justify-center h-9 w-9 rounded-md text-[hsl(var(--ink-muted))] hover:bg-accent hover:text-[hsl(var(--ink-body))] transition-colors">
              <Paperclip className="h-3.5 w-3.5" />
            </span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a margin note…"
            rows={1}
            disabled={busy}
            className="flex-1 min-h-[36px] max-h-32 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm text-[hsl(var(--ink-body))] placeholder:text-[hsl(var(--ink-muted))] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-[hsl(var(--surface-panel))] disabled:opacity-60"
          />
          <Button
            type="button"
            variant="default"
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={send}
            disabled={busy || (!input.trim() && !pendingFile)}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Bubble — picks the right renderer per card type
// ============================================

function Bubble({
  bubble,
  onIntent,
  sessionId,
}: {
  bubble: SADChatBubble;
  onIntent?: (i: ChatIntent) => void;
  sessionId: string;
}) {
  if (bubble.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-foreground text-background px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
          {bubble.text}
        </div>
      </div>
    );
  }

  if (!bubble.card) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg bg-card border border-border px-3 py-2 text-sm text-[hsl(var(--ink-body))] whitespace-pre-wrap shadow-sm">
          {bubble.text}
        </div>
      </div>
    );
  }

  const { type, payload } = bubble.card;
  const p = payload as any;

  switch (type) {
    case "fact_saved":
      return (
        <CardFrame>
          <div className="font-medium text-[hsl(var(--ink-body))]">Saved as Fact</div>
          <div className="text-sm text-[hsl(var(--ink-body))]">{p.text}</div>
          {typeof p.suggested_section === "number" && (
            <div className="text-xs text-[hsl(var(--ink-muted))]">
              Looks relevant to Section {p.suggested_section}.
              {p.regen_proposed && " Want me to update it now?"}
            </div>
          )}
          {p.follow_up && <div className="text-sm text-[hsl(var(--ink-muted))] mt-2">{p.follow_up}</div>}
        </CardFrame>
      );
    case "doc_ingested": {
      const sections: number[] = Array.isArray(p.suggested_sections)
        ? p.suggested_sections.filter(
            (n: unknown): n is number =>
              typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10,
          )
        : typeof p.suggested_section === "number"
        ? [p.suggested_section]
        : [];
      const sectionsLabel = sections.length === 1 ? "Section" : "Sections";
      return (
        <CardFrame>
          <div className="font-medium text-[hsl(var(--ink-body))]">Document ingested</div>
          <div className="text-sm text-[hsl(var(--ink-body))]">📎 {p.filename}</div>
          {sections.length > 0 && (
            <div className="text-xs text-[hsl(var(--ink-muted))]">
              Looks relevant to {sectionsLabel} {sections.join(", ")}.
            </div>
          )}
          {p.auto_regen && (
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] font-semibold text-[hsl(var(--primary))]">
              Folding into the SAD now — regeneration started.
            </div>
          )}
        </CardFrame>
      );
    }
    case "section_view":
      return (
        <CardFrame>
          <div className="font-medium text-[hsl(var(--ink-body))]">
            Section {p.n}: {p.title}
          </div>
          <div className="text-xs text-[hsl(var(--ink-muted))]">(opened in the section view on the right)</div>
        </CardFrame>
      );
    case "section_updated":
    case "section_regenerated":
      return (
        <CardFrame>
          <div className="font-medium text-[hsl(var(--ink-body))]">
            Section {p.n} {type === "section_updated" ? "updated" : "regenerated"}
          </div>
          <div className="text-xs text-[hsl(var(--ink-muted))]">{p.title}</div>
        </CardFrame>
      );
    case "audit":
      return (
        <CardFrame>
          <div className="font-medium mb-1 text-[hsl(var(--ink-body))]">Audit complete</div>
          <ul className="space-y-1 text-sm text-[hsl(var(--ink-body))]">
            {(p.badges as any[])?.map((b) => (
              <li key={b.n} className="flex items-center gap-2">
                <span>{b.icon}</span>
                <span className="font-mono w-6 tabular-nums">{b.n}.</span>
                <span className="flex-1 truncate">{b.title}</span>
                <span className="text-xs text-[hsl(var(--ink-muted))]">{b.score}</span>
              </li>
            ))}
          </ul>
        </CardFrame>
      );
    case "suggestions":
      return (
        <CardFrame>
          <div className="font-medium mb-1 text-[hsl(var(--ink-body))]">
            Suggestions for Section {p.n}: {p.title}
          </div>
          <ul className="space-y-2 text-sm text-[hsl(var(--ink-body))]">
            {(p.items as any[])?.map((it, idx) => (
              <li key={idx} className="border border-border rounded p-2">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-[hsl(var(--ink-muted))]">{it.rationale}</div>
              </li>
            ))}
            {(!p.items || p.items.length === 0) && (
              <li className="text-xs text-[hsl(var(--ink-muted))]">(no suggestions)</li>
            )}
          </ul>
        </CardFrame>
      );
    case "generation_starting":
      return (
        <CardFrame>
          <div className="font-medium text-[hsl(var(--ink-body))]">Generating SAD…</div>
          <div className="text-xs text-[hsl(var(--ink-muted))]">
            This usually takes 60-120 seconds. Hang tight.
          </div>
        </CardFrame>
      );
    case "text":
    default:
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg bg-card border border-border px-3 py-2 text-sm text-[hsl(var(--ink-body))] whitespace-pre-wrap shadow-sm">
            {p.text || JSON.stringify(p)}
          </div>
        </div>
      );
  }
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] p-3 space-y-1.5 rounded-lg bg-card border border-[hsl(var(--border-zone))] shadow-sm">
        {children}
      </div>
    </div>
  );
}
