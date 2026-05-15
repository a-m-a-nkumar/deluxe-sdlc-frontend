/**
 * LucidDashboard — Lucid AI authoring tab for the Diagram phase.
 *
 * Three plates, side-by-side, on the same parchment surface as the SAD
 * pane:
 *
 *   ┌─ Plate · 01 — Intake ─┬─ Plate · 02 — Architecture Prompt ┐
 *   │ Confluence pages      │ Diagram type · Logical / Infra /  │
 *   │ Search + checkboxes   │ Security                          │
 *   │                       │ Streaming prompt textarea         │
 *   │                       │                                   │
 *   │                       ├─ Plate · 03 — Issue ──────────────┤
 *   │                       │ Connect · title · Create via Lucid│
 *   └───────────────────────┴───────────────────────────────────┘
 *
 * Behaviour is identical to the original (verbatim copy from
 * lucid-frontend) — page selection, OAuth, prompt streaming, fullscreen,
 * copy — only the styling has been re-grounded in the editorial token
 * system (`src/styles/design-theme.css`). No SaaS-blue chips, no rounded
 * pillows, no soft pastel tints; just hairline rules, crimson revision
 * marks, and the same letterpress stamp buttons used elsewhere.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  AlertCircle,
  Check,
  CheckSquare,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  Link2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Server,
  Shield,
  Square,
  Wand2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState } from "@/contexts/AppStateContext";
import {
  fetchConfluencePageDetails,
  fetchConfluencePages,
  type ConfluencePage,
} from "@/services/confluenceApi";
import {
  createLucidViaMcp,
  generateLucidPromptStream,
  getLucidAuthUrl,
  getLucidStatus,
  listLucidDocuments,
  importLucidDocument,
  fetchLucidPreviewBlobUrl,
  type LucidDocumentSummary,
} from "@/services/lucidApi";
import { integrationsApi } from "@/services/integrationsApi";
import { cn } from "@/lib/utils";

type DiagramType = "logical" | "infrastructure" | "security";

const DIAGRAM_TYPES: ReadonlyArray<{
  key: DiagramType;
  plate: string;
  title: string;
  subtitle: string;
  marginalia: string;
  audience: string;
  Icon: typeof Layers;
}> = [
  {
    key: "logical",
    plate: "L · 01",
    title: "Logical",
    subtitle: "What & Why",
    marginalia:
      "Vendor-agnostic capabilities and the data flowing between them.",
    audience: "Devs · Architects · Business",
    Icon: Layers,
  },
  {
    key: "infrastructure",
    plate: "I · 02",
    title: "Infrastructure",
    subtitle: "Where & How",
    marginalia: "Where the system runs and how the pieces are wired.",
    audience: "DevOps · SRE · Platform",
    Icon: Server,
  },
  {
    key: "security",
    plate: "S · 03",
    title: "Security",
    subtitle: "Who & Protected",
    marginalia: "Trust boundaries, controls, and access policies.",
    audience: "Security · Auditors · Compliance",
    Icon: Shield,
  },
];

interface LucidDashboardProps {
  /** When set (typically from DiagramPhaseHost), the type was already
   * picked at the hub. The 3-card type picker is hidden, the type is
   * pinned to this value, and ProgressStrip / IssuePlate reflect it. */
  lockedDiagramType?: DiagramType;
  /** Active design session id. Required for the Plate 04 import flow
   * (fetches a Lucid diagram and writes it to this session's slot).
   * When absent, the import plate renders a "no active session" hint. */
  sessionId?: string;
  /** Fired after a successful Lucid import so the parent (e.g. the
   * diagram hub) can refresh slot statuses to reflect the new artifact. */
  onLucidImported?: (artifactKey: string, diagramType: DiagramType) => void;
}

export const LucidDashboard = ({
  lockedDiagramType,
  sessionId,
  onLucidImported,
}: LucidDashboardProps = {}) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { selectedProject } = useAppState();
  const location = useLocation();

  const confluenceSpaceKey = selectedProject?.confluence_space_key ?? null;

  // ── state (unchanged from the original) ─────────────────────────────
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const [diagramTitle, setDiagramTitle] = useState("");
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [diagramUrl, setDiagramUrl] = useState("");

  const [isLucidConnected, setIsLucidConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // ── Plate 04 (Import) state ─────────────────────────────────────────
  // Personal-API-key based import: after the user creates the diagram in
  // lucid.app, they search/pick their doc here and pull it back as SVG.
  const [hasLucidApiKey, setHasLucidApiKey] = useState<boolean | null>(null); // null = loading
  const [importSearch, setImportSearch] = useState("");
  const [importDocs, setImportDocs] = useState<LucidDocumentSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewArtifactKey, setPreviewArtifactKey] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [diagramTypeState, setDiagramTypeState] = useState<DiagramType>(
    lockedDiagramType ?? "infrastructure",
  );
  const diagramType = lockedDiagramType ?? diagramTypeState;
  const setDiagramType = (t: DiagramType) => {
    if (lockedDiagramType) return;
    setDiagramTypeState(t);
  };
  useEffect(() => {
    if (lockedDiagramType) setDiagramTypeState(lockedDiagramType);
  }, [lockedDiagramType]);

  const [copied, setCopied] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  const promptScrollRef = useRef<HTMLTextAreaElement | null>(null);

  // Tail-follow the streaming prompt, like the SAD chat does.
  useEffect(() => {
    if (!isGeneratingPrompt) return;
    const el = promptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [generatedPrompt, isGeneratingPrompt]);

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const step1Done = selectedPageIds.size > 0;
  const step2Done = generatedPrompt.trim().length > 0 && !isGeneratingPrompt;
  const step3Done = !!diagramUrl;
  const isProcessing = isGeneratingPrompt || isCreatingDiagram;

  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadPages = async (spaceKey: string) => {
    if (!accessToken) return;
    setIsLoadingPages(true);
    setPages([]);
    setSelectedPageIds(new Set());
    try {
      const result = await fetchConfluencePages(accessToken, spaceKey);
      setPages(result);
      if (result.length === 0) {
        toast({
          title: "No pages found",
          description: `No pages found in space "${spaceKey}".`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to load pages",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPages(false);
    }
  };

  useEffect(() => {
    if (confluenceSpaceKey && accessToken) {
      loadPages(confluenceSpaceKey);
    } else {
      setPages([]);
      setSelectedPageIds(new Set());
    }
  }, [confluenceSpaceKey, accessToken]);

  useEffect(() => {
    setGeneratedPrompt("");
    setDiagramUrl("");
    setSelectedPageIds(new Set());
  }, [selectedProject?.id]);

  useEffect(() => {
    setGeneratedPrompt("");
    setDiagramUrl("");
  }, [diagramType]);

  useEffect(() => {
    getLucidStatus()
      .then(setIsLucidConnected)
      .catch(() => setIsLucidConnected(false));
  }, []);

  // Check whether the user has linked their personal Lucid REST API key
  // in Profile. Drives whether Plate 04 (Import) shows the picker or a
  // "link your key in profile" CTA.
  useEffect(() => {
    if (!accessToken) {
      setHasLucidApiKey(false);
      return;
    }
    integrationsApi
      .getLucidStatus(accessToken)
      .then((s) => setHasLucidApiKey(s.linked && s.key_valid))
      .catch(() => setHasLucidApiKey(false));
  }, [accessToken]);

  // After a successful import, fetch the saved SVG with the bearer token
  // and convert to a same-origin blob URL the <img> can render.
  // The preview endpoint requires auth, which <img src> cannot carry —
  // same pattern the SAD viewer uses for its diagram blocks.
  useEffect(() => {
    if (!previewArtifactKey || !sessionId || !accessToken) {
      setPreviewBlobUrl(null);
      return;
    }
    let revokeTarget: string | null = null;
    let cancelled = false;
    fetchLucidPreviewBlobUrl(accessToken, sessionId, diagramType)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revokeTarget = url;
        setPreviewBlobUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[LucidDashboard] preview blob fetch failed:", err);
        setPreviewBlobUrl(null);
      });
    return () => {
      cancelled = true;
      if (revokeTarget) URL.revokeObjectURL(revokeTarget);
    };
  }, [previewArtifactKey, sessionId, diagramType, accessToken]);

  // Suggested search title: the type + the project name so the doc the
  // user just generated in Lucid AI tends to be at the top of the list.
  const suggestedSearch = useMemo(() => {
    const typeLabel = DIAGRAM_TYPES.find((t) => t.key === diagramType)?.title ?? "";
    const projectLabel = selectedProject?.project_name ?? "";
    return [typeLabel, projectLabel].filter(Boolean).join(" — ");
  }, [diagramType, selectedProject?.project_name]);

  // When the user opens / refreshes the picker, fetch their docs.
  const fetchImportDocs = useCallback(async () => {
    if (!hasLucidApiKey) return;
    setIsLoadingDocs(true);
    setImportError(null);
    try {
      const result = await listLucidDocuments(importSearch, suggestedSearch);
      setImportDocs(result.documents);
    } catch (err: any) {
      setImportError(err.message || "Failed to list Lucid documents");
      setImportDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [hasLucidApiKey, importSearch, suggestedSearch]);

  // Fetch + preview the chosen doc. The server writes to S3 and patches
  // the slot — the preview just streams the saved SVG back.
  const handleFetchAndPreview = useCallback(async () => {
    if (!sessionId || !selectedDocId) return;
    setIsFetchingPreview(true);
    setImportError(null);
    try {
      const picked = importDocs.find((d) => d.document_id === selectedDocId);
      const result = await importLucidDocument({
        session_id: sessionId,
        document_id: selectedDocId,
        diagram_type: diagramType,
        document_title: picked?.title,
      });
      setPreviewArtifactKey(result.artifact_key);
      if (onLucidImported) onLucidImported(result.artifact_key, diagramType);
      toast({
        title: "Diagram imported",
        description: `Saved ${picked?.title ?? "the diagram"} to ${diagramType} slot.`,
      });
    } catch (err: any) {
      setImportError(err.message || "Failed to import Lucid diagram");
    } finally {
      setIsFetchingPreview(false);
    }
  }, [sessionId, selectedDocId, importDocs, diagramType, onLucidImported, toast]);

  // Reset import state when type changes (a fresh slot = fresh import).
  useEffect(() => {
    setSelectedDocId(null);
    setPreviewArtifactKey(null);
    setImportError(null);
  }, [diagramType, sessionId]);

  // OAuth callback ?lucid=connected | ?lucid=error
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lucid = params.get("lucid");
    if (lucid === "connected") {
      setIsLucidConnected(true);
      toast({
        title: "Lucid connected",
        description: "You can now create diagrams via Lucid AI.",
      });
      window.history.replaceState({}, "", location.pathname);
    } else if (lucid === "error") {
      toast({
        title: "Lucid connection failed",
        description: "Could not connect to Lucid. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location.search]);

  const handleConnectLucid = async () => {
    setIsConnecting(true);
    try {
      const url = await getLucidAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      toast({
        title: "Failed to connect",
        description: error.message,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const togglePage = (id: string) => {
    if (isProcessing) return;
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (isProcessing) return;
    if (
      selectedPageIds.size === filteredPages.length &&
      filteredPages.length > 0
    ) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(filteredPages.map((p) => p.id)));
    }
  };

  const handleGeneratePrompt = async () => {
    if (selectedPageIds.size === 0 || !selectedProject) return;
    setIsGeneratingPrompt(true);
    setGeneratedPrompt("");
    try {
      const selectedPages = pages.filter((p) => selectedPageIds.has(p.id));
      const pageContents = await Promise.all(
        selectedPages.map((p) =>
          fetchConfluencePageDetails(p.id, accessToken!).then((details) =>
            details.body.storage.value
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
          ),
        ),
      );
      await generateLucidPromptStream(
        {
          project_id: selectedProject.id,
          page_contents: pageContents,
          diagram_type: diagramType,
        },
        (text) => setGeneratedPrompt((prev) => prev + text),
      );
    } catch (error: any) {
      toast({
        title: "Failed to generate prompt",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCreateDiagram = async () => {
    if (!generatedPrompt.trim()) return;
    setIsCreatingDiagram(true);
    setDiagramUrl("");
    try {
      const title =
        diagramTitle.trim() ||
        `${selectedProject?.project_name ?? "Architecture"} Diagram`;
      const result = await createLucidViaMcp({ prompt: generatedPrompt, title });
      setDiagramUrl(result.edit_url);
      toast({
        title: "Diagram created",
        description: "Lucid AI built your architecture diagram.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to create diagram",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingDiagram(false);
    }
  };

  const activeType = DIAGRAM_TYPES.find((t) => t.key === diagramType)!;

  // ── render ──────────────────────────────────────────────────────────

  return (
    <div className="design-surface flex flex-col h-full overflow-hidden">
      {/* Three-step plate strip */}
      <ProgressStrip
        steps={[
          { label: "Intake · Pages", done: step1Done },
          { label: "Prompt · Review", done: step2Done },
          { label: "Issue · Lucid AI", done: step3Done },
        ]}
      />

      <PanelGroup
        direction="horizontal"
        autoSaveId="design-lucid-panels"
        className="flex-1 min-h-0"
      >
        <Panel defaultSize={32} minSize={22} maxSize={50}>
          <IntakePanel
            confluenceSpaceKey={confluenceSpaceKey}
            projectName={selectedProject?.project_name}
            isLoadingPages={isLoadingPages}
            isProcessing={isProcessing}
            isGeneratingPrompt={isGeneratingPrompt}
            isCreatingDiagram={isCreatingDiagram}
            pages={pages}
            filteredPages={filteredPages}
            selectedPageIds={selectedPageIds}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            togglePage={togglePage}
            toggleAll={toggleAll}
            onReload={() => confluenceSpaceKey && loadPages(confluenceSpaceKey)}
            onGenerate={handleGeneratePrompt}
            hasProject={!!selectedProject}
          />
        </Panel>

        <PanelResizeHandle className="design-resize-handle" />

        <Panel defaultSize={68} minSize={50}>
          <div className="h-full overflow-y-auto p-5 space-y-5 design-stagger">
            {/* Picker hidden when the hub-driven flow has locked the type. */}
            {!lockedDiagramType && (
              <DiagramTypeCard
                types={DIAGRAM_TYPES}
                active={diagramType}
                onPick={setDiagramType}
                disabled={isProcessing}
              />
            )}

            <PromptPlate
              activeType={activeType}
              generatedPrompt={generatedPrompt}
              setGeneratedPrompt={setGeneratedPrompt}
              isGeneratingPrompt={isGeneratingPrompt}
              step2Done={step2Done}
              copied={copied}
              onCopy={handleCopyPrompt}
              onExpand={() => setIsPromptExpanded(true)}
              promptScrollRef={promptScrollRef}
            />

            <IssuePlate
              step2Done={step2Done}
              isLucidConnected={isLucidConnected}
              isConnecting={isConnecting}
              onConnect={handleConnectLucid}
              diagramTitle={diagramTitle}
              setDiagramTitle={setDiagramTitle}
              fallbackTitle={selectedProject?.project_name}
              isCreatingDiagram={isCreatingDiagram}
              onCreate={handleCreateDiagram}
              diagramUrl={diagramUrl}
              generatedPrompt={generatedPrompt}
            />

            <ImportPlate
              hasLucidApiKey={hasLucidApiKey}
              sessionId={sessionId}
              diagramType={diagramType}
              importSearch={importSearch}
              setImportSearch={setImportSearch}
              importDocs={importDocs}
              isLoadingDocs={isLoadingDocs}
              onRefreshDocs={fetchImportDocs}
              selectedDocId={selectedDocId}
              setSelectedDocId={setSelectedDocId}
              isFetchingPreview={isFetchingPreview}
              onFetchAndPreview={handleFetchAndPreview}
              previewArtifactKey={previewArtifactKey}
              previewBlobUrl={previewBlobUrl}
              importError={importError}
            />
          </div>
        </Panel>
      </PanelGroup>

      {isPromptExpanded && (
        <PromptOverlay
          activeType={activeType}
          value={generatedPrompt}
          onChange={setGeneratedPrompt}
          isGeneratingPrompt={isGeneratingPrompt}
          copied={copied}
          onCopy={handleCopyPrompt}
          onClose={() => setIsPromptExpanded(false)}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Sub-components — each painted strictly from design-* tokens.
// ────────────────────────────────────────────────────────────────────────

interface ProgressStep {
  label: string;
  done: boolean;
}

const ProgressStrip = ({ steps }: { steps: ProgressStep[] }) => {
  const activeIdx = steps.findIndex((s) => !s.done);
  return (
    <div
      className="flex items-stretch gap-0 border-b"
      style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
    >
      {steps.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = s.done;
        return (
          <div
            key={s.label}
            className="flex-1 flex items-center gap-2 px-4 py-2 border-r last:border-r-0"
            style={{ borderColor: "hsl(var(--design-rule) / 0.45)" }}
          >
            <span
              className="design-mono"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isDone
                  ? "hsl(var(--design-emerald))"
                  : isActive
                  ? "hsl(var(--design-mark))"
                  : "hsl(var(--design-ink-muted))",
              }}
            >
              0{i + 1}
            </span>
            <span className="design-eyebrow">{s.label}</span>
            {isDone && (
              <Check
                className="w-3 h-3 ml-auto"
                style={{ color: "hsl(var(--design-emerald))" }}
              />
            )}
            {isActive && !isDone && (
              <span
                className="design-dot design-dot--red ml-auto design-pulse-mark"
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface IntakePanelProps {
  confluenceSpaceKey: string | null;
  projectName?: string;
  isLoadingPages: boolean;
  isProcessing: boolean;
  isGeneratingPrompt: boolean;
  isCreatingDiagram: boolean;
  pages: ConfluencePage[];
  filteredPages: ConfluencePage[];
  selectedPageIds: Set<string>;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  togglePage: (id: string) => void;
  toggleAll: () => void;
  onReload: () => void;
  onGenerate: () => void;
  hasProject: boolean;
}

const IntakePanel = ({
  confluenceSpaceKey,
  projectName,
  isLoadingPages,
  isProcessing,
  isGeneratingPrompt,
  isCreatingDiagram,
  pages,
  filteredPages,
  selectedPageIds,
  searchQuery,
  setSearchQuery,
  togglePage,
  toggleAll,
  onReload,
  onGenerate,
  hasProject,
}: IntakePanelProps) => {
  return (
    <div className="h-full flex flex-col px-5 py-4">
      <div className="flex items-baseline justify-between mb-3 flex-shrink-0">
        <div>
          <div className="design-eyebrow">Plate · 01 — Intake</div>
          <h3 className="design-heading mt-0.5" style={{ fontSize: "1.05rem" }}>
            Confluence pages
          </h3>
        </div>
        {confluenceSpaceKey && (
          <button
            onClick={onReload}
            disabled={isLoadingPages}
            className="design-btn-ghost"
            title="Reload pages"
            style={{ padding: "0.3rem 0.5rem" }}
          >
            {isLoadingPages ? (
              <span className="design-mono">…</span>
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {confluenceSpaceKey ? (
        <div className="design-cartouche mb-3 self-start">
          <span className="design-cartouche__field-label">space</span>
          <span className="design-cartouche__divider">·</span>
          <span className="design-cartouche__field-value">
            {confluenceSpaceKey}
          </span>
          {projectName && (
            <>
              <span className="design-cartouche__divider">·</span>
              <span
                className="design-cartouche__field-value truncate"
                style={{ maxWidth: "9rem" }}
              >
                {projectName}
              </span>
            </>
          )}
        </div>
      ) : (
        <div
          className="design-marginalia mb-3 flex items-center gap-2"
          style={{ fontSize: "0.78rem" }}
        >
          <AlertCircle
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: "hsl(var(--design-amber))" }}
          />
          {hasProject
            ? `No Confluence space configured for "${projectName}".`
            : "Pick a project to load pages."}
        </div>
      )}

      {pages.length > 0 && (
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter pages…"
          className="design-chat-input mb-3 flex-shrink-0"
          style={{ fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}
        />
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {pages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
            <FileText
              className="w-7 h-7"
              style={{ color: "hsl(var(--design-rule))" }}
            />
            <p
              className="design-marginalia"
              style={{ fontSize: "0.82rem", maxWidth: "16rem" }}
            >
              {!hasProject
                ? "Select a project to load pages."
                : !confluenceSpaceKey
                ? "No Confluence space wired to this project."
                : isLoadingPages
                ? "Loading pages…"
                : "No pages found in this space."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <button
                onClick={toggleAll}
                disabled={isProcessing}
                className={cn(
                  "design-mono flex items-center gap-1.5 transition-colors",
                  isProcessing ? "opacity-40 cursor-not-allowed" : "",
                )}
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "hsl(var(--design-ink-muted))",
                }}
              >
                {selectedPageIds.size === filteredPages.length &&
                filteredPages.length > 0 ? (
                  <CheckSquare className="w-3 h-3" />
                ) : (
                  <Square className="w-3 h-3" />
                )}
                {selectedPageIds.size === filteredPages.length &&
                filteredPages.length > 0
                  ? "Deselect all"
                  : "Select all"}
              </button>
              <span
                className="design-mono"
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "hsl(var(--design-ink-muted))",
                }}
              >
                {selectedPageIds.size} / {filteredPages.length}
              </span>
            </div>

            <div className="relative flex-1 min-h-0">
              {isProcessing && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                  style={{
                    background: "hsl(var(--design-paper) / 0.85)",
                    border: "1px solid hsl(var(--design-rule))",
                  }}
                >
                  <div
                    className="w-5 h-5 animate-spin rounded-full border-2"
                    style={{
                      borderColor: "hsl(var(--design-mark))",
                      borderTopColor: "transparent",
                    }}
                  />
                  <span
                    className="design-mono text-center px-3"
                    style={{
                      fontSize: "0.65rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "hsl(var(--design-ink-muted))",
                    }}
                  >
                    {isGeneratingPrompt
                      ? "Generating prompt…"
                      : isCreatingDiagram
                      ? "Issuing to Lucid…"
                      : "Working…"}
                    <br />
                    <span className="design-marginalia">selection locked</span>
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "h-full overflow-y-auto",
                  isProcessing && "pointer-events-none select-none opacity-50",
                )}
              >
                {filteredPages.map((page) => {
                  const checked = selectedPageIds.has(page.id);
                  return (
                    <button
                      key={page.id}
                      onClick={() => togglePage(page.id)}
                      disabled={isProcessing}
                      className="design-row"
                      data-active={checked}
                    >
                      {checked ? (
                        <CheckSquare
                          className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]"
                          style={{ color: "hsl(var(--design-mark))" }}
                        />
                      ) : (
                        <Square
                          className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]"
                          style={{ color: "hsl(var(--design-rule))" }}
                        />
                      )}
                      <FileText
                        className="w-3 h-3 flex-shrink-0 mt-[3px]"
                        style={{ color: "hsl(var(--design-ink-muted))" }}
                      />
                      <span
                        className="truncate"
                        style={{
                          fontSize: "0.85rem",
                          color: "hsl(var(--design-ink))",
                        }}
                      >
                        {page.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="mt-3 pt-3 flex-shrink-0 border-t"
        style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
      >
        <button
          className="design-btn-mark w-full justify-center"
          onClick={onGenerate}
          disabled={
            selectedPageIds.size === 0 ||
            isGeneratingPrompt ||
            !confluenceSpaceKey
          }
        >
          {isGeneratingPrompt ? (
            <>
              <div
                className="w-3 h-3 animate-spin rounded-full border-2"
                style={{
                  borderColor: "currentColor",
                  borderTopColor: "transparent",
                }}
              />
              Generating
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Generate Prompt
            </>
          )}
        </button>
        {selectedPageIds.size > 0 && !isGeneratingPrompt && (
          <p
            className="design-marginalia text-center mt-1.5"
            style={{ fontSize: "0.74rem" }}
          >
            {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""} marked
          </p>
        )}
      </div>
    </div>
  );
};

interface DiagramTypeCardProps {
  types: typeof DIAGRAM_TYPES;
  active: DiagramType;
  onPick: (t: DiagramType) => void;
  disabled?: boolean;
}

const DiagramTypeCard = ({
  types,
  active,
  onPick,
  disabled,
}: DiagramTypeCardProps) => (
  <div className="design-plate p-4">
    <div className="flex items-baseline justify-between mb-3">
      <div className="design-eyebrow">Specification · Diagram type</div>
      <span className="design-marginalia" style={{ fontSize: "0.74rem" }}>
        Three views, one drawing.
      </span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {types.map((t) => {
        const isActive = active === t.key;
        const Icon = t.Icon;
        return (
          <button
            key={t.key}
            onClick={() => onPick(t.key)}
            disabled={disabled}
            className={cn(
              "design-plate text-left p-3 transition-colors",
              disabled && "opacity-50 cursor-not-allowed",
              !disabled && "cursor-pointer",
              isActive && "design-plate--mark",
            )}
            style={{
              background: isActive
                ? "hsl(var(--design-mark-soft))"
                : "hsl(var(--design-paper))",
            }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <span
                className="design-mono"
                style={{
                  fontSize: "0.66rem",
                  letterSpacing: "0.18em",
                  color: isActive
                    ? "hsl(var(--design-mark))"
                    : "hsl(var(--design-ink-muted))",
                }}
              >
                {t.plate}
              </span>
              <Icon
                className="w-4 h-4"
                style={{
                  color: isActive
                    ? "hsl(var(--design-mark))"
                    : "hsl(var(--design-ink-soft))",
                }}
              />
            </div>
            <h4
              className="design-heading"
              style={{
                fontSize: "1.05rem",
                marginBottom: "0.1rem",
                color: "hsl(var(--design-ink))",
              }}
            >
              {t.title}
            </h4>
            <p
              className="design-marginalia"
              style={{ fontSize: "0.78rem", marginBottom: "0.45rem" }}
            >
              {t.subtitle} — {t.marginalia}
            </p>
            <span
              className="design-mono"
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "hsl(var(--design-ink-muted))",
              }}
            >
              {t.audience}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

interface PromptPlateProps {
  activeType: typeof DIAGRAM_TYPES[number];
  generatedPrompt: string;
  setGeneratedPrompt: (s: string) => void;
  isGeneratingPrompt: boolean;
  step2Done: boolean;
  copied: boolean;
  onCopy: () => void;
  onExpand: () => void;
  promptScrollRef: React.RefObject<HTMLTextAreaElement>;
}

const PromptPlate = ({
  activeType,
  generatedPrompt,
  setGeneratedPrompt,
  isGeneratingPrompt,
  step2Done,
  copied,
  onCopy,
  onExpand,
  promptScrollRef,
}: PromptPlateProps) => {
  const hasContent = !!generatedPrompt || isGeneratingPrompt;
  return (
    <div
      className={cn(
        "design-plate p-4 flex flex-col gap-3",
        step2Done && "design-plate--mark",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="design-eyebrow">Plate · 02 — Architecture prompt</div>
          <h3 className="design-heading mt-0.5" style={{ fontSize: "1.1rem" }}>
            {activeType.title} · {activeType.subtitle}
          </h3>
        </div>
        {hasContent && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onCopy}
              className="design-btn-ghost"
              style={{ padding: "0.3rem 0.55rem" }}
              title="Copy prompt to clipboard"
            >
              {copied ? (
                <>
                  <Check
                    className="w-3 h-3"
                    style={{ color: "hsl(var(--design-emerald))" }}
                  />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={onExpand}
              className="design-btn-ghost"
              style={{ padding: "0.3rem 0.55rem" }}
              title="Expand to full screen"
            >
              <Maximize2 className="w-3 h-3" />
              Expand
            </button>
          </div>
        )}
      </div>

      <p className="design-marginalia" style={{ fontSize: "0.82rem" }}>
        Claude reads the marked Confluence pages and writes a structured
        diagram prompt. Hand-tune any line you want before issuing it to
        Lucid.
      </p>

      {!hasContent ? (
        <div
          className="flex flex-col items-center justify-center text-center gap-2 py-8 border border-dashed"
          style={{ borderColor: "hsl(var(--design-rule))" }}
        >
          <Wand2
            className="w-7 h-7"
            style={{ color: "hsl(var(--design-rule))" }}
          />
          <p
            className="design-marginalia"
            style={{ fontSize: "0.82rem", maxWidth: "20rem" }}
          >
            Mark pages on the left, then click{" "}
            <span className="design-mono">Generate Prompt</span>.
          </p>
        </div>
      ) : (
        <textarea
          ref={promptScrollRef}
          value={generatedPrompt}
          onChange={(e) => setGeneratedPrompt(e.target.value)}
          placeholder={
            isGeneratingPrompt ? "Generating architecture prompt…" : ""
          }
          className="design-chat-input"
          style={{
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: "0.8rem",
            lineHeight: 1.55,
            minHeight: "260px",
          }}
          disabled={isGeneratingPrompt}
          spellCheck={false}
        />
      )}
    </div>
  );
};

interface IssuePlateProps {
  step2Done: boolean;
  isLucidConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  diagramTitle: string;
  setDiagramTitle: (s: string) => void;
  fallbackTitle?: string;
  isCreatingDiagram: boolean;
  onCreate: () => void;
  diagramUrl: string;
  generatedPrompt: string;
}

const IssuePlate = ({
  step2Done,
  isLucidConnected,
  isConnecting,
  onConnect,
  diagramTitle,
  setDiagramTitle,
  fallbackTitle,
  isCreatingDiagram,
  onCreate,
  diagramUrl,
  generatedPrompt,
}: IssuePlateProps) => (
  <div
    className={cn(
      "design-plate p-4 flex flex-col gap-3 transition-opacity",
      !step2Done && "opacity-50 pointer-events-none",
      diagramUrl && "design-plate--mark",
    )}
  >
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="design-eyebrow">Plate · 03 — Issue</div>
        <h3 className="design-heading mt-0.5" style={{ fontSize: "1.1rem" }}>
          Send to Lucid AI
        </h3>
      </div>

      {isLucidConnected ? (
        <div
          className="design-cartouche flex-shrink-0"
          style={{
            background: "hsl(var(--design-paper))",
            borderColor: "hsl(var(--design-emerald))",
            color: "hsl(var(--design-emerald))",
          }}
        >
          <span className="design-dot design-dot--green" />
          <span>Connected</span>
        </div>
      ) : (
        <button
          className="design-btn-ghost flex-shrink-0"
          onClick={onConnect}
          disabled={isConnecting}
          style={{ padding: "0.35rem 0.7rem" }}
        >
          {isConnecting ? (
            <>
              <div
                className="w-3 h-3 animate-spin rounded-full border-2"
                style={{
                  borderColor: "currentColor",
                  borderTopColor: "transparent",
                }}
              />
              Connecting
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" />
              Connect to Lucid
            </>
          )}
        </button>
      )}
    </div>

    {!isLucidConnected && (
      <p
        className="design-marginalia flex items-center gap-1.5"
        style={{ fontSize: "0.8rem", color: "hsl(var(--design-amber))" }}
      >
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        Authorise your Lucid account before issuing the prompt.
      </p>
    )}

    <div className="flex items-center gap-3">
      <span
        className="design-eyebrow flex-shrink-0"
        style={{ minWidth: "5rem" }}
      >
        Title
      </span>
      <input
        value={diagramTitle}
        onChange={(e) => setDiagramTitle(e.target.value)}
        placeholder={`${fallbackTitle ?? "Architecture"} Diagram`}
        className="design-chat-input flex-1"
        style={{ fontSize: "0.85rem", padding: "0.4rem 0.6rem" }}
      />
    </div>

    <button
      className="design-btn-mark justify-center"
      onClick={onCreate}
      disabled={
        !generatedPrompt.trim() || isCreatingDiagram || !isLucidConnected
      }
    >
      {isCreatingDiagram ? (
        <>
          <div
            className="w-3.5 h-3.5 animate-spin rounded-full border-2"
            style={{
              borderColor: "currentColor",
              borderTopColor: "transparent",
            }}
          />
          Issuing
        </>
      ) : (
        <>
          <Wand2 className="w-3.5 h-3.5" />
          Issue to Lucid AI
        </>
      )}
    </button>

    {diagramUrl && (
      <a
        href={diagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 design-mono"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "hsl(var(--design-mark))",
        }}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open diagram in Lucidchart
      </a>
    )}
  </div>
);

// ──────────────────────────────────────────────────────────────────────
// Plate 04 — Import diagram from Lucid via personal API key
// ──────────────────────────────────────────────────────────────────────

interface ImportPlateProps {
  hasLucidApiKey: boolean | null;
  sessionId?: string;
  diagramType: DiagramType;
  importSearch: string;
  setImportSearch: (s: string) => void;
  importDocs: LucidDocumentSummary[];
  isLoadingDocs: boolean;
  onRefreshDocs: () => void;
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  isFetchingPreview: boolean;
  onFetchAndPreview: () => void;
  previewArtifactKey: string | null;
  previewBlobUrl: string | null;
  importError: string | null;
}

const ImportPlate = ({
  hasLucidApiKey,
  sessionId,
  diagramType,
  importSearch,
  setImportSearch,
  importDocs,
  isLoadingDocs,
  onRefreshDocs,
  selectedDocId,
  setSelectedDocId,
  isFetchingPreview,
  onFetchAndPreview,
  previewArtifactKey,
  previewBlobUrl,
  importError,
}: ImportPlateProps) => (
  <div className="design-plate p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <div className="design-eyebrow">PLATE · 04 — IMPORT DIAGRAM</div>
        <div className="design-heading text-sm mt-1">
          Pull your Lucid diagram back into this session
        </div>
      </div>
    </div>

    {hasLucidApiKey === null && (
      <div className="text-xs design-marginalia">Checking Lucid connection…</div>
    )}

    {hasLucidApiKey === false && (
      <div className="text-xs design-marginalia">
        No Lucid API key on file. Add one in{" "}
        <a href="/profile" className="underline" style={{ color: "hsl(var(--design-mark))" }}>
          Profile → Integrations → Lucid
        </a>{" "}
        to enable diagram import.
      </div>
    )}

    {hasLucidApiKey && !sessionId && (
      <div className="text-xs design-marginalia">
        Open this Lucid tab from inside an active design session to import a diagram.
      </div>
    )}

    {hasLucidApiKey && sessionId && (
      <>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search Lucid documents (defaults to suggested title)…"
            value={importSearch}
            onChange={(e) => setImportSearch(e.target.value)}
            className="flex-1 design-input"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.6rem" }}
          />
          <button
            className="design-btn-ghost"
            onClick={onRefreshDocs}
            disabled={isLoadingDocs}
            title="Fetch documents from Lucid"
          >
            {isLoadingDocs ? "Loading…" : "Refresh"}
          </button>
        </div>

        {importDocs.length === 0 && !isLoadingDocs && (
          <div className="text-xs design-marginalia">
            No Lucid documents fetched yet. Click <b>Refresh</b> to list your recent diagrams.
          </div>
        )}

        {importDocs.length > 0 && (
          <div
            className="border rounded max-h-48 overflow-y-auto"
            style={{ borderColor: "hsl(var(--design-rule))" }}
          >
            {importDocs.map((doc) => (
              <label
                key={doc.document_id}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer border-b text-sm"
                style={{
                  borderColor: "hsl(var(--design-rule))",
                  background:
                    selectedDocId === doc.document_id
                      ? "hsl(var(--design-mark) / 0.06)"
                      : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="lucid-doc-pick"
                  checked={selectedDocId === doc.document_id}
                  onChange={() => setSelectedDocId(doc.document_id)}
                />
                <span className="flex-1 truncate">{doc.title}</span>
                {doc.last_modified && (
                  <span
                    className="design-mono"
                    style={{
                      fontSize: "0.65rem",
                      color: "hsl(var(--design-ink-muted))",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {new Date(doc.last_modified).toLocaleString()}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            className="design-btn-mark"
            onClick={onFetchAndPreview}
            disabled={!selectedDocId || isFetchingPreview}
          >
            {isFetchingPreview ? "Fetching…" : "Fetch & Save"}
          </button>
          <span className="design-marginalia text-xs">
            Saves to the <b>{diagramType}</b> slot for this session.
          </span>
        </div>

        {importError && (
          <div
            className="text-xs rounded px-3 py-2"
            style={{
              background: "hsl(var(--destructive) / 0.08)",
              color: "hsl(var(--destructive))",
              border: "1px solid hsl(var(--destructive) / 0.3)",
            }}
          >
            {importError}
          </div>
        )}

        {previewArtifactKey && sessionId && (
          <div className="space-y-2">
            <div
              className="design-eyebrow"
              style={{ fontSize: "0.65rem", letterSpacing: "0.14em" }}
            >
              SAVED PREVIEW
            </div>
            <div
              className="border rounded overflow-hidden bg-white"
              style={{ borderColor: "hsl(var(--design-rule))" }}
            >
              {previewBlobUrl ? (
                <img
                  src={previewBlobUrl}
                  alt={`Lucid ${diagramType} diagram preview`}
                  className="block w-full h-auto"
                  style={{ maxHeight: "420px", objectFit: "contain" }}
                />
              ) : (
                <div
                  className="design-marginalia text-xs p-4 text-center"
                  style={{ color: "hsl(var(--design-ink-muted))" }}
                >
                  Loading preview…
                </div>
              )}
            </div>
            <div className="design-marginalia text-xs">
              The diagram has been saved to the session. It will be embedded in
              the SAD when you generate / regenerate sections 4 / 6 / 7.
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

interface PromptOverlayProps {
  activeType: typeof DIAGRAM_TYPES[number];
  value: string;
  onChange: (s: string) => void;
  isGeneratingPrompt: boolean;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

const PromptOverlay = ({
  activeType,
  value,
  onChange,
  isGeneratingPrompt,
  copied,
  onCopy,
  onClose,
}: PromptOverlayProps) => (
  <div
    className="design-surface fixed inset-0 z-50 flex flex-col"
    style={{ background: "hsl(var(--design-paper))" }}
  >
    <div
      className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
      style={{ borderColor: "hsl(var(--design-rule-strong))" }}
    >
      <div>
        <div className="design-eyebrow">Plate · 02 — Architecture prompt</div>
        <h3 className="design-heading mt-0.5" style={{ fontSize: "1.05rem" }}>
          {activeType.title} · {activeType.subtitle}
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="design-btn-ghost"
          style={{ padding: "0.35rem 0.7rem" }}
        >
          {copied ? (
            <>
              <Check
                className="w-3 h-3"
                style={{ color: "hsl(var(--design-emerald))" }}
              />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
        <button
          onClick={onClose}
          className="design-btn-ghost"
          style={{ padding: "0.35rem 0.7rem" }}
        >
          <Minimize2 className="w-3 h-3" />
          Close
        </button>
      </div>
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isGeneratingPrompt ? "Generating architecture prompt…" : ""}
      className="flex-1 w-full p-6 design-chat-input"
      style={{
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: "0.85rem",
        lineHeight: 1.6,
        border: "none",
        borderRadius: 0,
        resize: "none",
      }}
      disabled={isGeneratingPrompt}
      spellCheck={false}
    />
  </div>
);
