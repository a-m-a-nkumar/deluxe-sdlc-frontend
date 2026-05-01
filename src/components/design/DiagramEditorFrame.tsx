/**
 * DiagramEditorFrame — focused single-diagram authoring surface.
 *
 * Wraps the existing DesignDashboard (Draw.io) or LucidDashboard (Lucid)
 * as its body, scoped to the active diagram type. Adds the slim editorial
 * header strip from screen 10c with `Save & close` and `× Close`, plus the
 * dirty-warning marginalia when closing with unsaved changes.
 *
 * Per P5 ("Returning never destroys"), closing without save restores the
 * pre-edit slot state (Pending or Done).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Save, X } from "lucide-react";
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
  // Reopening a Done slot starts non-dirty; this listener flips it on first
  // interaction.
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
    <div className="design-surface flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <div
          className="design-plate design-plate--mark flex-1 flex flex-col overflow-hidden design-rise"
        >
          {/* ── Slim editorial header ── */}
          <div
            className="px-5 py-4 border-b flex items-start justify-between gap-4 flex-shrink-0"
            style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
          >
            <div className="min-w-0">
              <div className="design-eyebrow">{headerEyebrow}</div>
              <h1
                className="design-heading mt-1"
                style={{ fontSize: "1.5rem", lineHeight: 1.22 }}
              >
                {label.title}
              </h1>
              <div
                className="design-marginalia mt-1 flex items-center gap-2 flex-wrap"
                style={{ fontSize: "0.82rem" }}
              >
                {slot.savedAt ? (
                  <span
                    className="design-mono"
                    style={{
                      fontStyle: "normal",
                      fontSize: "0.78rem",
                      letterSpacing: "0.04em",
                      color: "hsl(var(--design-ink-muted))",
                    }}
                  >
                    Saved at {formatTime(slot.savedAt)}
                    {dirty && " · Edited"}
                  </span>
                ) : dirty ? (
                  <span style={{ color: "hsl(var(--design-mark-deep))" }}>
                    Unsaved changes
                  </span>
                ) : (
                  <span>Compose your prompt and draft the diagram.</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                ref={closeRef}
                type="button"
                className="design-btn-ghost"
                onClick={handleCloseRequest}
                aria-label="Close editor (Esc)"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
              <button
                type="button"
                className="design-btn-mark"
                onClick={handleSave}
                disabled={saving}
                aria-label="Save and close (⌘+Enter)"
                title="Save & close (⌘/Ctrl+Enter)"
              >
                {saving ? (
                  <>
                    <span
                      className="w-3 h-3 animate-spin rounded-full border-2"
                      style={{
                        borderColor: "currentColor",
                        borderTopColor: "transparent",
                      }}
                    />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save & close
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Dirty warning (inline, no modal) ── */}
          {showDirtyWarning && (
            <div className="px-5 pt-3 flex-shrink-0">
              <Banner
                variant="recoverable"
                title="Unsaved changes"
                actions={
                  <>
                    <button
                      type="button"
                      className="design-btn-ghost"
                      autoFocus
                      onClick={() => setShowDirtyWarning(false)}
                    >
                      Keep editing
                    </button>
                    <button
                      type="button"
                      className="design-btn-link"
                      onClick={handleCloseAnyway}
                    >
                      Close anyway
                    </button>
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
            <div className="px-5 pt-3 flex-shrink-0">
              <Banner
                variant="recoverable"
                title="Couldn't save"
                actions={
                  <button
                    type="button"
                    className="design-btn-mark"
                    onClick={handleSave}
                  >
                    Try again
                  </button>
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
              <LucidDashboard lockedDiagramType={type} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
