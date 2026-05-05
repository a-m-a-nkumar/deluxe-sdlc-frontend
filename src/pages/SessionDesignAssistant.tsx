/**
 * SessionDesignAssistant — multi-session Design Assistant page.
 *
 * Layout:
 *   ┌─ Sidebar (sessions) ─┬─ PhaseSwitcher ───────────────────┐
 *   │                      │                                    │
 *   │                      │  Diagram phase: existing          │
 *   │                      │  DesignDashboard wrapped with     │
 *   │                      │  a session header + Save-to-      │
 *   │                      │  Session button                    │
 *   │                      │                                    │
 *   │                      │  OR                                │
 *   │                      │                                    │
 *   │                      │  SAD phase: SectionList + view +   │
 *   │                      │  SADChat                           │
 *   └──────────────────────┴────────────────────────────────────┘
 *
 * The existing DesignDashboard component is unmodified — we wrap it.
 * Eventually it should be threaded with `session_id` to write XML/SVG to
 * S3 directly; for v1 we offer a "Save to session" button at the page
 * level that does the SVG export + session save.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MainLayout } from "@/components/layout/MainLayout";
import { DesignSessionSidebar } from "@/components/design/DesignSessionSidebar";
import { PhaseSwitcher, type DesignPhase } from "@/components/design/PhaseSwitcher";
import { DesignDashboard } from "@/components/dashboard/DesignDashboard";
import { LucidDashboard } from "@/components/dashboard/LucidDashboard";
import { DiagramPhaseHost } from "@/components/design/DiagramPhaseHost";
import { SADChat } from "@/components/sad/SADChat";
import { SADDocumentView } from "@/components/sad/SADDocumentView";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import {
  DesignSessionLocal,
  createDesignSession,
  deleteDesignSession,
  getDesignSession,
  getDesignSessionHistory,
  listDesignSessions,
  patchDesignSession,
  type DesignSession,
} from "@/services/designSessionApi";
import type { SADChatBubble } from "@/components/sad/SADChat";
import { loadDiagramForSession, saveDiagramToSession } from "@/services/designApi";
import { exportDrawioXmlAsSvg } from "@/services/sadDiagramExport";
import {
  getSadSections,
  downloadSadDocx,
  sadGenerate,
  sadAudit,
  type SADSectionsList,
} from "@/services/sadApi";
import { Download, FileBarChart2, Save, Sparkles, Upload } from "lucide-react";

const DRAWIO_ORIGIN = "https://embed.diagrams.net";

/**
 * Locate the visible draw.io editor iframe (rendered by DesignDashboard
 * during Plate 00). Returns null when not on the diagram phase.
 *
 * Why we keep finding by selector instead of holding a ref: the editor
 * mounts/unmounts when the user toggles between Plate 00 and the SAD
 * phase, and DesignDashboard owns its own ref. A querySelector keeps the
 * extraction logic local to the page-level Save handler.
 */
function findVisibleEditorIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[src*="diagrams.net"]');
}

/**
 * Ask the visible editor iframe for its current mxGraph XML.
 * Resolves with the raw XML or rejects on timeout.
 */
function requestXmlFromVisibleIframe(): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = findVisibleEditorIframe();
    if (!iframe?.contentWindow) {
      reject(new Error("Diagram editor not found on screen"));
      return;
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== DRAWIO_ORIGIN) return;
      let data: any;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "export" && data.format === "xml" && typeof data.xml === "string") {
        window.removeEventListener("message", onMessage);
        window.clearTimeout(timer);
        resolve(data.xml);
      }
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for diagram XML"));
    }, 10_000);
    window.addEventListener("message", onMessage);
    iframe.contentWindow.postMessage(
      JSON.stringify({ action: "export", format: "xml" }),
      DRAWIO_ORIGIN,
    );
  });
}

/**
 * Ask the visible draw.io EDITOR iframe (in Plate 00) for a PNG render.
 *
 * This works where the chrome=0&edit=0 viewer iframe in the SAD page
 * does NOT — the editor build of draw.io has the export API enabled,
 * the viewer build appears to silently drop `action: export`. So PNG
 * capture only happens at Save-to-session time, when the editor is
 * on screen.
 *
 * Resolves with `data:image/png;base64,...`.
 */
function requestPngFromVisibleIframe(): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = findVisibleEditorIframe();
    if (!iframe?.contentWindow) {
      reject(new Error("Diagram editor not found on screen"));
      return;
    }
    const t0 = Date.now();
    const stamp = () => `${(Date.now() - t0).toString().padStart(5)}ms`;
    console.log(`[draw.io PNG] ${stamp()} requesting PNG from editor iframe`);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== DRAWIO_ORIGIN) return;
      let data: any;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event !== "export") return;
      if (data.format !== "png" && data.format !== "xmlpng") return;
      const url: string = data.data ?? data.message ?? "";
      if (!url.startsWith("data:image/png;")) return;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      console.log(`[draw.io PNG] ${stamp()} got PNG (${url.length} chars)`);
      resolve(url);
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for diagram PNG (30s)"));
    }, 30_000);
    window.addEventListener("message", onMessage);
    iframe.contentWindow.postMessage(
      JSON.stringify({
        action: "export",
        format: "png",
        embedImages: false,
        spin: false,
      }),
      DRAWIO_ORIGIN,
    );
  });
}

interface RouteParams extends Record<string, string | undefined> {
  projectId?: string;
  sessionId?: string;
}

export default function SessionDesignAssistant() {
  const { projectId: routeProjectId, sessionId: routeSessionId } = useParams<RouteParams>();
  const [searchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get("project_id") ?? undefined;
  const { selectedProject } = useAppState();
  const projectId =
    routeProjectId
    ?? projectIdFromQuery
    ?? selectedProject?.project_id
    ?? DesignSessionLocal.getProjectId()
    ?? null;
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<DesignSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    routeSessionId ?? DesignSessionLocal.getSessionId(),
  );
  const [currentSession, setCurrentSession] = useState<DesignSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [phase, setPhase] = useState<DesignPhase>("diagram");
  // Sub-tab inside the diagram phase: which authoring tool is on screen.
  // Draw.io is the default and the flow that feeds the SAD phase. Lucid
  // is offered alongside as an alternate authoring path; its output is a
  // hosted Lucidchart URL, not in-session XML, so the Save-to-session
  // affordance is hidden while it's active.
  const [diagramAuthor, setDiagramAuthor] = useState<"drawio" | "lucid">("drawio");
  const [collapsed, setCollapsed] = useState(false);

  // SAD-phase state
  const [sectionsList, setSectionsList] = useState<SADSectionsList | null>(null);
  // The section the user is *currently looking at* — fed to the chat as
  // `viewing_section` so commands like "make this edit" resolve to the
  // right section. Driven by IntersectionObserver inside SADDocumentView,
  // and also set when the user clicks a row in the TOC.
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  // Bumped only when the user CLICKS a TOC row — triggers a one-shot scroll
  // in the document view. We can't simply watch `selectedSection` for that,
  // because the IntersectionObserver writes to it during scroll and would
  // create a feedback loop.
  const [scrollNonce, setScrollNonce] = useState(0);
  const [sectionRefreshKey, setSectionRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [savingDiagram, setSavingDiagram] = useState(false);
  // Chat messages live at page level so they survive the GATHERING ↔ REFINING
  // phase transition (which otherwise unmounts the old SADChat and remounts
  // a fresh one in the right rail, blowing away local state).
  const [chatMessages, setChatMessages] = useState<SADChatBubble[]>([]);
  const appendChatMessage = useCallback((bubble: SADChatBubble) => {
    setChatMessages((prev) => [...prev, bubble]);
  }, []);

  // Saved diagram XML for this session — loaded once on session change so
  // the editor in Plate 00 opens pre-populated. Without this, switching back
  // to Plate 00 on a session that already has a diagram showed the "select
  // Confluence pages" empty state.
  const [sessionDiagramXml, setSessionDiagramXml] = useState<string | undefined>(undefined);

  const { toast } = useToast();

  // ---- Persist project selection in localStorage (mirrors analyst flow) ----
  useEffect(() => {
    if (projectId) DesignSessionLocal.setProjectId(projectId);
  }, [projectId]);

  // ---- Reset session state when the user switches projects ----
  // Without this, the sidebar refetches sessions for the new project but
  // the main view keeps rendering the old project's session (currentSession,
  // chat history, SAD sections, diagram XML). Track the previous projectId
  // and clear all session-derived state when it actually changes.
  const prevProjectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    const prev = prevProjectIdRef.current;
    if (prev !== null && prev !== projectId) {
      setCurrentSessionId(null);
      setCurrentSession(null);
      setSessionDiagramXml(undefined);
      setSectionsList(null);
      setSelectedSection(null);
      setChatMessages([]);
      setPhase("diagram");
      DesignSessionLocal.setSessionId(null);
    }
    prevProjectIdRef.current = projectId;
  }, [projectId]);

  // ---- Load session list ----
  const refreshSessions = useCallback(async () => {
    if (!projectId) return;
    setLoadingSessions(true);
    try {
      const list = await listDesignSessions(projectId);
      setSessions(list);
    } finally {
      setLoadingSessions(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // ---- Load current session details ----
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSession(null);
      return;
    }
    DesignSessionLocal.setSessionId(currentSessionId);
    getDesignSession(currentSessionId)
      .then((s) => {
        setCurrentSession(s);
        // Auto-switch to SAD phase if the session is past the diagram step
        if (s.stage === "SAD_GATHERING" || s.stage === "SAD_GENERATING" || s.stage === "SAD_REFINING") {
          setPhase("sad");
        } else {
          setPhase("diagram");
        }
      })
      .catch(() => {
        setCurrentSession(null);
        setCurrentSessionId(null);
      });
  }, [currentSessionId]);

  // ---- Load chat history when the session changes ----
  // CRITICAL: clear chatMessages IMMEDIATELY at the top of the effect, before
  // any async work. Without this, switching from a session with chats to one
  // without leaves the old session's bubbles on screen until the fetch
  // resolves — which never re-renders if the new session is empty.
  useEffect(() => {
    setChatMessages([]);
    if (!currentSessionId) return;

    let cancelled = false;
    getDesignSessionHistory(currentSessionId)
      .then((history) => {
        if (cancelled) return;
        const bubbles: SADChatBubble[] = history.map((m, i) => ({
          id: `h-${i}-${m.ts ?? i}`,
          role: m.role === "assistant" ? "assistant" : "user",
          text: m.content,
        }));
        setChatMessages(bubbles);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load chat history", err);
          setChatMessages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  // ---- Load SAD sections list when entering SAD phase post-generation ----
  useEffect(() => {
    if (phase !== "sad" || !currentSessionId || !currentSession) return;
    if (currentSession.stage !== "SAD_REFINING") {
      setSectionsList(null);
      return;
    }
    getSadSections(currentSessionId)
      .then(setSectionsList)
      .catch(() => setSectionsList(null));
  }, [phase, currentSessionId, currentSession?.stage, sectionRefreshKey]);

  // ---- Load saved diagram XML for the session (so Plate 00 opens with it) ----
  // Always attempt the load — `diagram_s3_key` on the session row may be
  // out of sync with what's actually in S3 (older sessions, save partial
  // failures). The endpoint returns 404 when nothing's there; we treat
  // that as "no saved diagram yet" silently.
  useEffect(() => {
    setSessionDiagramXml(undefined);
    if (!currentSessionId || !projectId) return;
    let cancelled = false;
    loadDiagramForSession(projectId, currentSessionId)
      .then((res) => {
        if (cancelled) return;
        if (res?.xml && res.xml.trim()) {
          console.log(
            `[SAD] loaded session diagram XML (${res.xml.length} chars, source=${res.source})`,
          );
          setSessionDiagramXml(res.xml);
        }
      })
      .catch((e) => {
        // 404 or actual fetch failure — Plate 00 will just show the empty
        // "Select Confluence pages" state in either case.
        console.info("[SAD] no saved diagram XML for this session", e);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSessionId, projectId]);

  // ---- Session actions ----
  const handleNew = useCallback(async () => {
    if (!projectId) return;
    const s = await createDesignSession(projectId);
    setSessions((prev) => [s, ...prev]);
    setCurrentSessionId(s.id);
  }, [projectId]);

  const handleSelect = useCallback((id: string) => setCurrentSessionId(id), []);

  const handleRename = useCallback(async (id: string, name: string) => {
    const updated = await patchDesignSession(id, { name });
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    if (currentSessionId === id) setCurrentSession(updated);
  }, [currentSessionId]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDesignSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      DesignSessionLocal.setSessionId(null);
    }
  }, [currentSessionId]);

  const handleContinueToSad = useCallback(async () => {
    if (!currentSessionId) return;
    const updated = await patchDesignSession(currentSessionId, { stage: "SAD_GATHERING" });
    setCurrentSession(updated);
    setPhase("sad");
  }, [currentSessionId]);

  const handleSkipDiagram = useCallback(async () => {
    if (!currentSessionId) return;
    const updated = await patchDesignSession(currentSessionId, { stage: "SAD_GATHERING" });
    setCurrentSession(updated);
    setPhase("sad");
  }, [currentSessionId]);

  const handleGenerateSad = useCallback(async () => {
    if (!currentSessionId) return;
    setGenerating(true);
    try {
      await sadGenerate(currentSessionId, projectId ?? undefined, undefined);
      // After generation, refresh session + sections
      const fresh = await getDesignSession(currentSessionId);
      setCurrentSession(fresh);
      const list = await getSadSections(currentSessionId);
      setSectionsList(list);
      setSelectedSection(list.sections[0]?.number ?? null);
    } finally {
      setGenerating(false);
    }
  }, [currentSessionId, projectId]);

  const handleSaveDiagramToSession = useCallback(async (
    diagramType?: "logical" | "infrastructure" | "security",
  ) => {
    if (!currentSessionId || !projectId) return;
    setSavingDiagram(true);
    try {
      const xml = await requestXmlFromVisibleIframe();
      if (!xml || !xml.trim() || !xml.includes("mxGraphModel")) {
        toast({
          title: "No diagram to save",
          description: "Generate a diagram first, then click Save to session.",
          variant: "destructive",
        });
        return;
      }
      // Capture all three render formats from the visible editor iframe IN
      // PARALLEL. Each is best-effort:
      //   • XML — already extracted above; required.
      //   • PNG — used by DOCX export (python-docx native embed). The
      //     editor iframe responds to the export API; the SAD-page viewer
      //     iframe (chrome=0&edit=0) does not.
      //   • SVG — used for in-app `<img>` rendering on the SAD section.
      //     Optional; the iframe-viewer fallback handles missing SVG.
      const [pngResult, svgResult] = await Promise.allSettled([
        requestPngFromVisibleIframe(),
        exportDrawioXmlAsSvg(xml),
      ]);
      const png = pngResult.status === "fulfilled" ? pngResult.value : undefined;
      const svg = svgResult.status === "fulfilled" ? svgResult.value : undefined;
      if (pngResult.status === "rejected") {
        console.warn("[SAD] PNG capture failed at save time", pngResult.reason);
      }
      if (svgResult.status === "rejected") {
        console.warn("[SAD] SVG capture failed at save time", svgResult.reason);
      }

      const result = await saveDiagramToSession({
        projectId,
        sessionId: currentSessionId,
        xml,
        svg,
        png,
        diagramType,
      });
      const fresh = await getDesignSession(currentSessionId);
      setCurrentSession(fresh);
      setSessions((prev) => prev.map((s) => (s.id === currentSessionId ? fresh : s)));

      const parts: string[] = ["XML"];
      if (png) parts.push("PNG");
      if (svg) parts.push("SVG");
      const persisted = parts.join(" + ");

      if (png) {
        toast({
          title: "Diagram saved to session",
          description: `Stored ${persisted}. DOCX export will embed the diagram inline.`,
        });
      } else {
        toast({
          title: `Diagram saved (${persisted})`,
          description:
            "PNG capture failed — the DOCX export will use the SVG fallback or a " +
            "placeholder for the diagram. The in-app viewer still works.",
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSavingDiagram(false);
    }
  }, [currentSessionId, projectId, toast]);

  /**
   * Manual PNG upload — the in-iframe export API is blocked in some
   * environments (Deluxe corporate network, content blockers, etc.) so
   * draw.io's `action: export, format: png` hangs indefinitely. Workaround:
   * the user exports the diagram via the editor's File → Export As → PNG
   * menu (which downloads a local PNG via the browser, no server-side
   * draw.io call), then uploads it here. We base64 it and post to
   * /api/design/save-diagram with the `png` field; the rest of the system
   * (DOCX export, in-app render) treats it identically to a programmatically
   * captured PNG.
   */
  const handleUploadDiagramPng = useCallback(async (file: File) => {
    if (!currentSessionId || !projectId) return;
    if (!file.type.startsWith("image/png")) {
      toast({
        title: "Wrong file type",
        description: "Pick a PNG. In the draw.io editor: File → Export As → PNG.",
        variant: "destructive",
      });
      return;
    }
    setSavingDiagram(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith("data:image/png;")) {
        throw new Error("File reader did not produce a PNG data URL");
      }
      await saveDiagramToSession({
        projectId,
        sessionId: currentSessionId,
        png: dataUrl,
      });
      const fresh = await getDesignSession(currentSessionId);
      setCurrentSession(fresh);
      setSessions((prev) => prev.map((s) => (s.id === currentSessionId ? fresh : s)));
      toast({
        title: "Diagram image uploaded",
        description: `${file.name} (${Math.round(file.size / 1024)} KB) — DOCX export will embed this.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setSavingDiagram(false);
    }
  }, [currentSessionId, projectId, toast]);

  // Stable callbacks for the SAD pane — without `useCallback` these were
  // recreated on every parent render (e.g. each chat-turn append), causing
  // SADDocumentView's IntersectionObserver useEffect to detach and reattach
  // continuously, losing hysteresis state and reporting wrong sections.
  const handleTocSelect = useCallback((n: number) => {
    console.log(`[SAD-VIEW] TOC click → scroll to section ${n}`);
    setSelectedSection(n);
    setScrollNonce((s) => s + 1);
  }, []);

  const handleActiveSectionChange = useCallback((n: number) => {
    setSelectedSection((prev) => {
      if (prev !== n) {
        console.log(
          `[SAD-VIEW] page state: selectedSection ${prev ?? "null"} → ${n} ` +
            `(this is what the chat will send as viewing_section)`,
        );
      }
      return n;
    });
  }, []);

  const handleSectionRefresh = useCallback(() => {
    setSectionRefreshKey((k) => k + 1);
  }, []);

  const handleAudit = useCallback(async () => {
    if (!currentSessionId) return;
    setAuditing(true);
    try {
      await sadAudit(currentSessionId, projectId ?? undefined);
      const list = await getSadSections(currentSessionId);
      setSectionsList(list);
    } finally {
      setAuditing(false);
    }
  }, [currentSessionId, projectId]);

  const sessionPlateLabel = currentSession?.name?.toUpperCase().slice(0, 24) ?? "—";
  const stageLabel = currentSession?.stage?.replace(/_/g, " ") ?? "—";

  return (
    <MainLayout currentView="design">
      {/*
        MainLayout renders children inside a `pt-16` wrapper with no explicit
        height — its own outer div is `overflow-auto`, so any tall page (like
        our SAD doc + chat panel) makes the WHOLE app scroll vertically.
        Pinning to `100vh - 4rem` (the header) gives the page a fixed window;
        the inner panes (TOC, document, chat) then scroll independently.
      */}
      <div
        className="design-surface flex overflow-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        <DesignSessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelect={handleSelect}
          onCreate={handleNew}
          onRename={handleRename}
          onDelete={handleDelete}
          isCollapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          isLoading={loadingSessions}
          onExportDocx={
            currentSession?.stage === "SAD_REFINING" && currentSessionId
              ? () => {
                  // Pass projectId so downloadSadDocx pre-renders the PNG
                  // (via the draw.io iframe) and saves it to S3 before
                  // fetching the DOCX. Backend will then embed the PNG
                  // directly. If the render fails, the DOCX still downloads
                  // — just with a placeholder where the diagram should be.
                  downloadSadDocx(
                    currentSessionId,
                    undefined,
                    projectId ?? undefined,
                  ).catch((e) =>
                    console.error("SAD DOCX download failed", e),
                  );
                }
              : undefined
          }
        />
        <div className="flex-1 flex flex-col min-w-0">
          {!projectId && (
            <div className="flex-1 flex items-center justify-center px-6 design-rise">
              <div className="max-w-md text-center space-y-3">
                <div className="design-eyebrow">Drafting Table</div>
                <h2 className="design-heading">No project selected.</h2>
                <p className="design-marginalia">
                  Pick a project from the top bar — its design sessions
                  appear here as a portfolio of plates.
                </p>
              </div>
            </div>
          )}
          {projectId && !currentSession && (
            <div className="flex-1 flex items-center justify-center px-6 design-rise">
              <div className="max-w-md text-center space-y-3">
                <div className="design-eyebrow">Portfolio</div>
                <h2 className="design-heading">Open a session, or start a new one.</h2>
                <p className="design-marginalia">
                  Each session holds one architecture diagram and one Software
                  Architecture Document. Nothing is shared across sessions.
                </p>
              </div>
            </div>
          )}
          {currentSession && (
            <>
              <PhaseSwitcher
                phase={phase}
                stage={currentSession.stage}
                onPhaseChange={setPhase}
                sessionLabel={sessionPlateLabel}
                stageLabel={stageLabel}
              />
              {phase === "diagram" && (
                <DiagramPhaseHost
                  sessionId={currentSession.id}
                  projectId={projectId}
                  onPersistDiagram={async ({ type }) => {
                    // Per-type save: backend writes to
                    // sessions/{id}/diagram/{type}.{xml,svg,png} and updates
                    // the matching JSONB slot. The host then re-fetches slots
                    // so the hub's "Saved at HH:MM" matches server time.
                    await handleSaveDiagramToSession(type);
                    return { artifactKey: undefined };
                  }}
                  onContinueToSad={handleContinueToSad}
                  onDownloadSad={async () => {
                    if (!currentSession) return;
                    await downloadSadDocx(
                      currentSession.id,
                      `SAD_${sessionPlateLabel}.docx`,
                      projectId ?? undefined,
                    );
                  }}
                  onOpenSadWorkspace={() => setPhase("sad")}
                />
              )}
              {phase === "sad" && (
                <SADPhasePane
                  sessionId={currentSession.id}
                  projectId={projectId}
                  stage={currentSession.stage}
                  sectionsList={sectionsList}
                  selectedSection={selectedSection}
                  scrollNonce={scrollNonce}
                  onTocSelect={handleTocSelect}
                  onActiveSectionChange={handleActiveSectionChange}
                  generating={generating}
                  auditing={auditing}
                  onGenerate={handleGenerateSad}
                  onAudit={handleAudit}
                  onSectionChange={handleSectionRefresh}
                  sectionRefreshKey={sectionRefreshKey}
                  chatMessages={chatMessages}
                  onAppendChatMessage={appendChatMessage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// ============================================
// SAD phase pane (split view: section list | section + chat)
// ============================================

interface SADPhasePaneProps {
  sessionId: string;
  projectId: string;
  stage: DesignSession["stage"];
  sectionsList: SADSectionsList | null;
  selectedSection: number | null;
  /** Bumped when the user clicks a TOC row → triggers scrollIntoView. */
  scrollNonce: number;
  /** Click in the left-rail TOC. */
  onTocSelect: (n: number) => void;
  /** IntersectionObserver in SADDocumentView reports the in-view section. */
  onActiveSectionChange: (n: number) => void;
  generating: boolean;
  auditing: boolean;
  onGenerate: () => void;
  onAudit: () => void;
  onSectionChange: () => void;
  sectionRefreshKey: number;
  chatMessages: SADChatBubble[];
  onAppendChatMessage: (bubble: SADChatBubble) => void;
}

function SADPhasePane({
  sessionId,
  projectId,
  stage,
  sectionsList,
  selectedSection,
  scrollNonce,
  onTocSelect,
  onActiveSectionChange,
  generating,
  auditing,
  onGenerate,
  onAudit,
  onSectionChange,
  sectionRefreshKey,
  chatMessages,
  onAppendChatMessage,
}: SADPhasePaneProps) {
  const isRefining = stage === "SAD_REFINING";

  const ruleBorder = { borderColor: "hsl(var(--design-rule) / 0.55)" };

  // Pre-generation: chat-only with a prominent "Generate SAD" button.
  if (!isRefining) {
    return (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        <div className="border-r flex flex-col min-h-0" style={ruleBorder}>
          <div className="px-4 py-3 flex items-center justify-between border-b design-rise" style={ruleBorder}>
            <div>
              <div className="design-eyebrow">Phase · Gathering</div>
              <h2 className="design-heading text-lg mt-0.5">
                Sketch the architecture before we draft.
              </h2>
            </div>
            <button type="button" className="design-btn-primary" disabled={generating} onClick={onGenerate}>
              <Sparkles className="h-3.5 w-3.5" />
              {generating ? "Drafting…" : "Generate SAD"}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SADChat
              sessionId={sessionId}
              projectId={projectId}
              viewingSection={null}
              messages={chatMessages}
              onAppendMessage={onAppendChatMessage}
              onIntent={(i) => {
                if (i.kind === "generation_started" && !generating) {
                  onGenerate();
                }
              }}
            />
          </div>
        </div>
        <aside
          className="hidden lg:flex flex-col border-l design-rise"
          style={{
            ...ruleBorder,
            background: "hsl(var(--design-paper-deep) / 0.6)",
            animationDelay: "120ms",
          }}
        >
          <div className="p-5">
            <div className="design-eyebrow">Output preview</div>
            <h3 className="design-heading mt-1">A 10-plate technical brief</h3>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "hsl(var(--design-ink-soft))" }}>
              Once enough context lands — facts, attached docs, the linked
              diagram — each plate appears here in the Deluxe SAD template.
            </p>
            <ol
              className="design-stagger mt-4 space-y-1.5 text-xs design-mono"
              style={{ color: "hsl(var(--design-ink-soft))" }}
            >
              {[
                "01  Summary",
                "02  Problem Statement",
                "03  Architecturally Significant Reqs",
                "04  Logical Architecture Diagram",
                "05  Pending Decisions",
                "06  Security View",
                "07  Infrastructure",
                "08  Risks & Mitigations",
                "09  Non-functional Reqs",
                "10  Cost Estimate",
              ].map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    );
  }

  // Refining: two-column resizable layout — document on the left, chat
  // docked on the right with a draggable handle in between. `autoSaveId`
  // persists the user's preferred split in localStorage across refreshes.
  // The previous section-index left rail was removed because the document
  // is now meant to read like a real document, with scroll as navigation.
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="sad-refining-doc-chat"
      className="flex-1 min-h-0"
    >
      <Panel defaultSize={65} minSize={35} className="flex flex-col min-h-0">
        <main className="flex flex-col min-h-0 flex-1">
          <div
            className="px-6 py-3 flex items-center justify-between border-b design-rise"
            style={ruleBorder}
          >
            <div>
              <div className="design-eyebrow">Document</div>
              <div className="design-heading text-base mt-0.5">Deluxe SAD</div>
            </div>
            <button
              type="button"
              className="design-btn-mark"
              disabled={auditing}
              onClick={onAudit}
              title="Run audit on every section"
            >
              <FileBarChart2 className="h-3.5 w-3.5" />
              {auditing ? "Auditing…" : "Audit document"}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {sectionsList ? (
              <SADDocumentView
                sessionId={sessionId}
                projectId={projectId}
                list={sectionsList}
                refreshKey={sectionRefreshKey}
                scrollToSection={selectedSection}
                scrollNonce={scrollNonce}
                onActiveSectionChange={onActiveSectionChange}
                onSectionsChanged={onSectionChange}
              />
            ) : (
              <div className="p-6 text-sm" style={{ color: "hsl(var(--design-ink-soft))" }}>
                <div className="design-eyebrow">Reading pane</div>
                <p className="design-marginalia mt-2">Loading the SAD…</p>
              </div>
            )}
          </div>
        </main>
      </Panel>
      <DesignResizeHandle />
      <Panel defaultSize={35} minSize={20} maxSize={60} className="flex flex-col min-h-0">
        <aside className="flex flex-col min-h-0 flex-1">
          <SADChat
            sessionId={sessionId}
            projectId={projectId}
            viewingSection={selectedSection}
            messages={chatMessages}
            onAppendMessage={onAppendChatMessage}
            onIntent={(i) => {
              if (i.kind === "section_changed" || i.kind === "audit_complete") {
                onSectionChange();
              } else if (i.kind === "generation_started" && !generating) {
                // Router decided this turn means "rebuild the whole SAD with
                // the latest facts/docs" — kick off regeneration in REFINING
                // just like we do in GATHERING.
                onGenerate();
              }
            }}
          />
        </aside>
      </Panel>
    </PanelGroup>
  );
}

/**
 * Vertical resize handle styled to match the design system: a hairline
 * `--design-rule` divider that thickens to crimson on hover/drag.
 * 6px hit area is comfortable for mouse, even though only the centre
 * 1px is visually rendered as the divider.
 */
function DesignResizeHandle() {
  return (
    <PanelResizeHandle className="design-resize-handle group" />
  );
}
