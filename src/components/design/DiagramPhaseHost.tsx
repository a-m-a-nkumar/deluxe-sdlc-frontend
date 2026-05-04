/**
 * DiagramPhaseHost — drives the redesigned diagram-phase screen state machine.
 *
 * Phase states (Stage 4 of the redesign):
 *   tool_select → hub → editor → hub → … → sad_confirm → sad_generating → sad_done
 *
 * This component is what SessionDesignAssistant renders inside the diagram
 * phase region. It owns the screen state, the diagram-slots hook, and the
 * handlers for save / generate-SAD that thread up to the parent.
 *
 * Backend deliberately untouched — all per-type slot state lives in
 * localStorage via useDiagramSlots. When the backend grows three slots,
 * this component is the only swap point.
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useDiagramSlots,
  type AuthoringTool,
  type DiagramType,
} from "@/hooks/useDiagramSlots";
import { ToolSelectionScreen } from "./ToolSelectionScreen";
import { DiagramHub } from "./DiagramHub";
import { DiagramEditorFrame } from "./DiagramEditorFrame";
import { SadGenerationConfirm } from "./SadGenerationConfirm";
import { SadGenerationInProgress } from "./SadGenerationInProgress";
import { SadGenerationDone } from "./SadGenerationDone";
import { Banner } from "./Banner";

type Screen =
  | { kind: "tool_select" }
  | { kind: "hub" }
  | { kind: "editor"; type: DiagramType }
  | { kind: "sad_confirm" }
  | { kind: "sad_generating" }
  | { kind: "sad_done" };

interface Props {
  sessionId: string | null;
  /** Project the session belongs to — required so the host can call
   *  /api/design/load-diagram per-type (the endpoint validates project
   *  ownership). */
  projectId: string | null;
  /** Persist the diagram artifact via the existing /api/design/save-diagram
   *  flow. Backend writes to per-type S3 keys based on the type field. */
  onPersistDiagram: (payload: {
    type: DiagramType;
    tool: AuthoringTool;
  }) => Promise<{ artifactKey?: string }>;
  /** Hand off from the diagram hub to the SAD pane. Advances the session
   *  stage to SAD_GATHERING and switches the parent's phase to "sad".
   *  Does NOT start LLM generation — the SAD pane has its own Generate
   *  button for that. This is what the bottom-right "Continue to SAD"
   *  button on the hub triggers (via the pre-flight confirm screen). */
  onContinueToSad: () => Promise<void> | void;
  /** Download the generated SAD as DOCX (used by sad_done screen, kept
   *  for parity with the older flow that auto-generated on confirm). */
  onDownloadSad: () => Promise<void> | void;
  /** Kept for backward compat. Not currently used since "Continue to SAD"
   *  uses onContinueToSad which also advances stage. */
  onOpenSadWorkspace: () => void;
}

export const DiagramPhaseHost = ({
  sessionId,
  projectId,
  onPersistDiagram,
  onContinueToSad,
  onDownloadSad,
  onOpenSadWorkspace,
}: Props) => {
  const slots = useDiagramSlots(sessionId);
  const { toast } = useToast();

  // Screen state — initial decided by tool presence.
  const [screen, setScreen] = useState<Screen>(
    slots.state.tool ? { kind: "hub" } : { kind: "tool_select" },
  );
  const [genError, setGenError] = useState<string | null>(null);

  // Per-type XML preload for the editor. When the user opens the editor for
  // type X, fetch sessions/{id}/diagram/{X}.xml from the server so the
  // draw.io iframe loads the matching saved diagram (not a stale Logical
  // copy from an earlier session-level fetch). `null` while loading or if
  // no saved XML for this type yet — the editor renders a fresh canvas.
  const [editorInitialXml, setEditorInitialXml] = useState<string | undefined>(undefined);
  const [editorXmlLoading, setEditorXmlLoading] = useState<boolean>(false);

  // Reload the per-type XML whenever the editor screen mounts for a new type.
  useEffect(() => {
    if (screen.kind !== "editor" || !sessionId || !projectId) {
      setEditorInitialXml(undefined);
      return;
    }
    let cancelled = false;
    setEditorXmlLoading(true);
    setEditorInitialXml(undefined); // clear any stale preload from a prior open
    (async () => {
      try {
        const { loadDiagramForSession } = await import("@/services/designApi");
        const result = await loadDiagramForSession(
          projectId,
          sessionId,
          undefined,
          undefined,
          screen.type,
        );
        if (cancelled) return;
        // 404 → null → editor opens with a fresh canvas (no preload).
        setEditorInitialXml(result?.xml || undefined);
      } catch (e) {
        if (cancelled) return;
        console.warn(`[DiagramPhaseHost] failed to load ${screen.type} XML:`, e);
        setEditorInitialXml(undefined);
      } finally {
        if (!cancelled) setEditorXmlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [screen, sessionId, projectId]);

  // Reconcile screen with tool presence on session change. If the user
  // lands on a session that doesn't have a tool yet, force tool_select.
  useEffect(() => {
    if (!slots.state.tool && screen.kind !== "tool_select") {
      setScreen({ kind: "tool_select" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.state.tool, sessionId]);

  const goHub = useCallback(() => setScreen({ kind: "hub" }), []);

  const handleSelectTool = useCallback(
    async (tool: AuthoringTool) => {
      // setTool is async (server roundtrip) — don't block the UI on it.
      void slots.setTool(tool);
      goHub();
    },
    [slots, goHub],
  );

  const handleOpenEditor = useCallback(
    (type: DiagramType) => {
      slots.open(type);
      setScreen({ kind: "editor", type });
    },
    [slots],
  );

  const handleSaveAndClose = useCallback(
    async (type: DiagramType) => {
      const tool = slots.state.tool ?? "drawio";
      try {
        const result = await onPersistDiagram({ type, tool });
        // Optimistic local flip so the hub paints Done before refresh()
        // returns; refresh() then reconciles with the server's canonical
        // savedAt timestamp.
        slots.markSaved(type, { artifactKey: result.artifactKey });
        goHub();
        // Re-fetch slots so the row's "Saved at HH:MM" matches the server
        // and any concurrent state (other tabs, soft-skipped neighbours)
        // is reconciled.
        void slots.refresh();
      } catch (e) {
        // Editor frame handles its own inline error banner — re-throw so it
        // surfaces there. Slot stays in_progress.
        throw e;
      }
    },
    [onPersistDiagram, slots, goHub],
  );

  const handleCloseWithoutSave = useCallback(
    (type: DiagramType) => {
      slots.closeWithoutSave(type);
      goHub();
    },
    [slots, goHub],
  );

  // Hand-off from confirm screen to the SAD pane. The user explicitly
  // chose to continue; we advance the session stage and the parent
  // re-renders the SAD pane in place. No LLM call here — generation is
  // a separate user action inside the SAD pane.
  const handleContinueToSad = useCallback(async () => {
    setGenError(null);
    try {
      await onContinueToSad();
      // Parent re-renders into the SAD pane; this component unmounts.
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "Couldn't switch to the SAD pane.",
      );
      setScreen({ kind: "hub" });
    }
  }, [onContinueToSad]);

  const handleChangeTool = useCallback(() => {
    setScreen({ kind: "tool_select" });
  }, []);

  // ── Render the active screen ────────────────────────────────────────
  // Each screen mounted with a `key` derived from its kind, so flipping
  // the screen unmounts the prior tree and re-runs `design-rise`. That
  // keyframe is the system's "one orchestrated entrance per plate"
  // motion vocabulary — same one used elsewhere in the SAD module.
  const renderScreen = () => {
    if (screen.kind === "tool_select") {
      return (
        <ToolSelectionScreen
          currentTool={slots.state.tool}
          onSelect={handleSelectTool}
          onCancel={slots.state.tool ? goHub : undefined}
        />
      );
    }

    if (screen.kind === "editor") {
      const type = screen.type;
      const tool = slots.state.tool ?? "drawio";
      // Don't render the editor until the per-type XML has finished
      // loading — otherwise draw.io initialises with empty XML and our
      // post-load `initialXml` push fails with a parse error in some
      // builds. A brief skeleton is fine; XML usually returns in <500ms.
      if (editorXmlLoading) {
        return (
          <div className="design-surface flex-1 flex items-center justify-center">
            <div className="design-mono" style={{
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "hsl(var(--design-ink-muted))",
            }}>Loading {type} diagram…</div>
          </div>
        );
      }
      return (
        <DiagramEditorFrame
          type={type}
          tool={tool}
          slot={slots.slot(type)}
          initialXml={editorInitialXml}
          onSaveAndClose={async () => {
            await handleSaveAndClose(type);
          }}
          onClose={() => handleCloseWithoutSave(type)}
        />
      );
    }

    if (screen.kind === "sad_confirm") {
      return (
        <SadGenerationConfirm
          slots={slots}
          onCancel={goHub}
          onConfirm={handleContinueToSad}
          onFix={(t) => {
            goHub();
            requestAnimationFrame(() => {
              const el = document.getElementById(`hub-row-${t}-title`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                (el.closest("[role='group']") as HTMLElement | null)?.focus?.();
              }
            });
          }}
        />
      );
    }

    if (screen.kind === "sad_generating") {
      return (
        <SadGenerationInProgress
          progressLabel="Reading your diagrams and drafting plates"
          detailLabel="This usually takes 60 to 120 seconds. Don't close the tab."
        />
      );
    }

    if (screen.kind === "sad_done") {
      return (
        <SadGenerationDone
          slots={slots}
          onBackToHub={goHub}
          onDownload={async () => {
            try {
              await onDownloadSad();
            } catch (e) {
              toast({
                title: "Download failed",
                description: e instanceof Error ? e.message : "Try again.",
                variant: "destructive",
              });
            }
          }}
          onOpenInWorkspace={onOpenSadWorkspace}
        />
      );
    }
    return null;
  };

  // Hub falls through to the bottom of the function — render it inline so
  // the genError banner can render above it. Editor / confirm / etc. each
  // get a keyed wrapper so design-rise replays on transition.
  if (screen.kind !== "hub") {
    return (
      <div key={`screen-${screen.kind}`} className="design-rise flex-1 flex flex-col min-h-0">
        {renderScreen()}
      </div>
    );
  }

  // ── Hub (default) ────────────────────────────────────────────────────
  const inProgressTypes = (["logical", "infrastructure", "security"] as DiagramType[]).filter(
    (t) => slots.slot(t).status === "in_progress",
  );

  return (
    <>
      {genError && (
        <div
          className="design-surface px-6 pt-4 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--design-rule) / 0.55)" }}
        >
          <Banner
            variant="recoverable"
            title="Couldn't continue to SAD"
            actions={
              <button
                type="button"
                className="design-btn-mark"
                onClick={handleContinueToSad}
              >
                Retry
              </button>
            }
          >
            {genError} Your saved diagrams are intact.
          </Banner>
        </div>
      )}
      <DiagramHub
        slots={slots}
        blockedByInProgress={inProgressTypes.length > 0 ? inProgressTypes : undefined}
        onOpenEditor={handleOpenEditor}
        onGenerateSad={() => setScreen({ kind: "sad_confirm" })}
        onChangeTool={handleChangeTool}
      />
    </>
  );
};
