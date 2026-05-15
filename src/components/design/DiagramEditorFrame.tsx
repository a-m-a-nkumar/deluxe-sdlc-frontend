/**
 * DiagramEditorFrame — focused single-diagram authoring surface.
 *
 * Wraps the existing DesignDashboard (Draw.io) or LucidDashboard (Lucid)
 * as its body, scoped to the active diagram type. Adds the slim header
 * strip from screen 10c with `Save & close` and `× Close`, plus the
 * dirty-warning marginalia when closing with unsaved changes.
 *
 * Surface treatment (per .interface-design/system.md §2 "Surface elevation"):
 *   • tier 1 (--surface-canvas)  — module body, framed by the pink page edges
 *   • tier 1 (border-zone)       — header strip & action-row hairlines
 *   • tier-3 buttons             — shadcn <Button> variants
 *
 * Per P5 ("Returning never destroys"), closing without save restores the
 * pre-edit slot state (Pending or Done).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "./Banner";
import { DesignDashboard } from "@/components/dashboard/DesignDashboard";
import { LucidDashboard } from "@/components/dashboard/LucidDashboard";
import {
  TYPE_LABEL,
  type AuthoringTool,
  type DiagramSlot,
  type DiagramType,
} from "@/hooks/useDiagramSlots";

interface Props {
  type: DiagramType;
  tool: AuthoringTool;
  slot: DiagramSlot;
  /** Active design session id. Forwarded to LucidDashboard so its Plate 04
   * (Import) knows which session's diagram slot to write. Required for
   * Lucid import; not used by the Draw.io path. */
  sessionId?: string | null;
  /** Initial XML to seed the Draw.io editor with — present when reopening
   *  a Done slot. Undefined for first-time generation. */
  initialXml?: string;
  /** Called when the user confirms save+close. Caller wires the actual
   *  persistence; this component only flips dirty/saved local state. */
  onSaveAndClose: (payload: { artifactKey?: string }) => Promise<void> | void;
  /** Called on close-without-save (Esc, × button, or after dirty confirm). */
  onClose: () => void;
}

const formatTime = (epochMs: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(epochMs));

export const DiagramEditorFrame = ({
  type,
  tool,
  slot,
  sessionId,
  initialXml,
  onSaveAndClose,
  onClose,
}: Props) => {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const label = TYPE_LABEL[type];

  const headerEyebrow = useMemo(
    () => `Plate · ${type === "logical" ? "01" : type === "infrastructure" ? "02" : "03"} — ${label.title.toUpperCase()}`,
    [type, label.title],
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveAndClose({});
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the diagram.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRequest = () => {
    if (dirty) {
      setShowDirtyWarning(true);
      return;
    }
    onClose();
  };

  const handleCloseAnyway = () => {
    setShowDirtyWarning(false);
    onClose();
  };

  // Keyboard shortcuts: Esc → close (with dirty warning), ⌘/Ctrl+S → save,
  // ⌘/Ctrl+Enter → save & close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseRequest();
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (meta && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving]);

  // Heuristic dirty-tracking: any keystroke or click inside the editor body
  // marks dirty until next save. Coarse but correct for the trust contract.
  const editorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onActivity = () => setDirty(true);
    el.addEventListener("input", onActivity);
    el.addEventListener("change", onActivity);
    return () => {
      el.removeEventListener("input", onActivity);
      el.removeEventListener("change", onActivity);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--surface-canvas))] border border-[hsl(var(--border-zone))] rounded-lg">
          {/* ── Slim header strip ── */}
          <div className="px-6 py-4 border-b border-[hsl(var(--border-zone))] flex items-start justify-between gap-4 flex-shrink-0">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[hsl(var(--ink-muted))]">
                {headerEyebrow}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--ink-body))] mt-1">
                {label.title}
              </h1>
              <div className="text-xs text-[hsl(var(--ink-muted))] mt-1 flex items-center gap-2 flex-wrap">
                {slot.savedAt ? (
                  <span className="font-mono tabular-nums">
                    Saved at {formatTime(slot.savedAt)}
                    {dirty && " · Edited"}
                  </span>
                ) : dirty ? (
                  <span className="text-[hsl(var(--primary))] font-medium">
                    Unsaved changes
                  </span>
                ) : (
                  <span>Compose your prompt and draft the diagram.</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                ref={closeRef}
                variant="ghost"
                size="sm"
                onClick={handleCloseRequest}
                aria-label="Close editor (Esc)"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Close
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                aria-label="Save and close (⌘+Enter)"
                title="Save & close (⌘/Ctrl+Enter)"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save & close
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Dirty warning (inline, no modal) ── */}
          {showDirtyWarning && (
            <div className="px-6 pt-3 flex-shrink-0">
              <Banner
                variant="recoverable"
                title="Unsaved changes"
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      autoFocus
                      onClick={() => setShowDirtyWarning(false)}
                    >
                      Keep editing
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleCloseAnyway}
                    >
                      Close anyway
                    </Button>
                  </>
                }
              >
                Closing now discards your changes. The previously-saved
                diagram (if any) stays intact.
              </Banner>
            </div>
          )}

          {/* ── Save error (inline, no modal) ── */}
          {error && (
            <div className="px-6 pt-3 flex-shrink-0">
              <Banner
                variant="recoverable"
                title="Couldn't save"
                actions={
                  <Button variant="default" size="sm" onClick={handleSave}>
                    Try again
                  </Button>
                }
              >
                {error} Your changes are still in the editor.
              </Banner>
            </div>
          )}

          {/* ── Editor body ── */}
          <div
            ref={editorRef}
            className="flex-1 min-h-0 overflow-hidden"
          >
            {tool === "drawio" ? (
              <DesignDashboard
                hideDocumentSteps
                initialXml={initialXml}
                lockedDiagramType={type}
              />
            ) : (
              <LucidDashboard
                lockedDiagramType={type}
                sessionId={sessionId ?? undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
