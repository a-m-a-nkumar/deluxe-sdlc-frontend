/**
 * DesignSessionSidebar — the portfolio.
 *
 * Each row is a sheet in a stack of drafts: serif title, mono metadata
 * underneath (stage + last activity). Active row has a 2px graphite rule
 * on the left, like the spine of the binder. The "+ New" button is a
 * graphite stamp.
 */

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileText,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { DesignSession, DesignStage } from "@/services/designSessionApi";

interface Props {
  sessions: DesignSession[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onRename: (sessionId: string, name: string) => void;
  onDelete: (sessionId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isLoading?: boolean;
  /** When set, renders an "Export DOCX" button pinned at the bottom of the
   * sidebar. Wired by the parent only when the current session has a SAD
   * (so a download actually exists). */
  onExportDocx?: () => void;
}

const STAGE_LABEL: Record<DesignStage, string> = {
  NEW: "New",
  DIAGRAM_GATHERING: "Drawing",
  DIAGRAM_READY: "Diagram ready",
  SAD_GATHERING: "Researching",
  SAD_GENERATING: "Generating",
  SAD_REFINING: "SAD ready",
};

const STAGE_DOT: Record<DesignStage, string> = {
  NEW: "design-dot--muted",
  DIAGRAM_GATHERING: "design-dot--amber",
  DIAGRAM_READY: "design-dot--amber",
  SAD_GATHERING: "design-dot--amber",
  SAD_GENERATING: "design-dot--amber",
  SAD_REFINING: "design-dot--green",
};

function formatRelative(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function DesignSessionSidebar({
  sessions,
  currentSessionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  isCollapsed = false,
  onToggleCollapse,
  isLoading = false,
  onExportDocx,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (s: DesignSession) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  if (isCollapsed) {
    return (
      <aside
        className="flex flex-col items-center gap-3 py-3 w-12 bg-[hsl(var(--surface-panel))] border-r border-[hsl(var(--border-zone))]"
      >
        <button
          type="button"
          className="design-btn-ghost"
          aria-label="Expand portfolio"
          onClick={onToggleCollapse}
          title="Expand portfolio"
          style={{ padding: "0.3rem" }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="design-btn-primary"
          aria-label="New session"
          onClick={onCreate}
          title="New session"
          style={{ padding: "0.4rem" }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col w-72 min-h-0 bg-[hsl(var(--surface-panel))] border-r border-[hsl(var(--border-zone))]"
    >
      <header className="px-3 pt-4 pb-3 border-b border-[hsl(var(--border-zone))]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="design-eyebrow">Portfolio</div>
            <div className="design-heading text-base mt-0.5">Sessions</div>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              className="design-btn-ghost"
              aria-label="Collapse portfolio"
              onClick={onToggleCollapse}
              style={{ padding: "0.3rem" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="design-btn-primary mt-3 w-full justify-center"
          onClick={onCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          New session
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="design-marginalia px-4 py-3">Loading the portfolio…</p>
        )}
        {!isLoading && sessions.length === 0 && (
          <p className="design-marginalia px-4 py-3">
            Empty portfolio. Press <span className="design-mono">New session</span> to start a draft.
          </p>
        )}
        <ul className="design-stagger px-1.5 py-2 space-y-1">
          {sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const isEditing = editingId === s.id;
            const stage = (s.stage as DesignStage) ?? "NEW";
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-start gap-2 cursor-pointer rounded-md px-3 py-2 transition-colors ${
                    isCurrent
                      ? "bg-card shadow-sm border-l-4 border-l-[hsl(var(--primary))]"
                      : "hover:bg-card border-l-4 border-l-transparent"
                  }`}
                  onClick={() => !isEditing && onSelect(s.id)}
                >
                  <FileText
                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                    style={{ color: "hsl(var(--design-ink-muted))" }}
                  />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(s.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="design-chat-input text-sm"
                          style={{ padding: "0.25rem 0.4rem" }}
                        />
                        <button
                          type="button"
                          className="design-btn-ghost"
                          style={{ padding: "0.3rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            saveEdit(s.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="design-btn-ghost"
                          style={{ padding: "0.3rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-[0.95rem] font-semibold leading-tight truncate text-[hsl(var(--ink-body))]">
                          {s.name}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--ink-muted))]">
                          <span className={`design-dot ${STAGE_DOT[stage]}`} />
                          <span>{STAGE_LABEL[stage] ?? stage}</span>
                          <span aria-hidden>·</span>
                          <span>{formatRelative(s.last_activity_ts)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                      <button
                        type="button"
                        className="design-btn-ghost"
                        style={{ padding: "0.25rem" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(s);
                        }}
                        title="Rename"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="design-btn-ghost"
                        style={{
                          padding: "0.25rem",
                          color: "hsl(var(--design-mark))",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete session "${s.name}"? This cannot be undone.`)) {
                            onDelete(s.id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {onExportDocx && (
        <div className="border-t border-[hsl(var(--border-zone))] px-3 py-2.5">
          <button
            type="button"
            className="design-btn-primary w-full justify-center"
            onClick={onExportDocx}
            title="Download the SAD as a DOCX"
          >
            <Download className="h-3 w-3" />
            Export DOCX
          </button>
        </div>
      )}
    </aside>
  );
}
