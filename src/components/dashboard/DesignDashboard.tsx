import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { RefreshCw, FileText, CheckSquare, Square, Wand2, Code2, Download, ChevronDown, AlertCircle, Maximize2, Minimize2, BookText, ExternalLink, Pencil, PlusCircle, Clock, Layers, Loader2, Server, Shield } from "lucide-react";
import type { DesignDiagramType } from "@/services/designApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState } from "@/contexts/AppStateContext";
import { fetchConfluencePages, fetchConfluencePageDetails, ConfluencePage } from "@/services/confluenceApi";
import { generateArchitecturePrompt, generateArchitecturePromptStream, generateDrawioXML, generateArchitectureDocument, generateArchitectureDocumentStream, pushDocumentToConfluence, saveDiagramToConfluence, loadDiagramFromConfluence, listSavedDiagrams, DiagramPageInfo } from "@/services/designApi";
import { cn } from "@/lib/utils";

interface DesignDashboardProps {
  /** When true, hide the "Generate Document"/"Push to Confluence" steps —
   * those actions are superseded by the SAD phase in session mode. */
  hideDocumentSteps?: boolean;
  /** When provided, pre-load this XML into the draw.io editor iframe so a
   * session that already has a saved diagram doesn't show the "Select
   * Confluence pages" empty state. The user lands directly on the editor
   * with their saved diagram and can keep editing. */
  initialXml?: string;
  /** When set (typically from DiagramPhaseHost), the dashboard is mounted
   * inside the redesigned diagram-hub flow where the diagram type was
   * already picked at the hub. The 3-card type picker is hidden, the
   * type is pinned to this value, and the headline reflects it. Without
   * this prop the dashboard keeps its legacy in-component picker for
   * standalone use at /design-assistant. */
  lockedDiagramType?: DesignDiagramType;
}

export const DesignDashboard = ({
  hideDocumentSteps = false,
  initialXml,
  lockedDiagramType,
}: DesignDashboardProps = {}) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { selectedProject } = useAppState();

  const confluenceSpaceKey = selectedProject?.confluence_space_key ?? null;

  // Step 1 — Confluence page selection
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 — Enhanced prompt
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Step 3 — draw.io XML. Seeded from `initialXml` (session's saved diagram)
  // when it's provided, so the editor opens with the existing diagram instead
  // of the empty "select pages" state.
  const [generatedXML, setGeneratedXML] = useState(initialXml ?? "");
  const [isGeneratingXML, setIsGeneratingXML] = useState(false);

  // Sync generatedXML when the parent passes a different `initialXml` later
  // (e.g. user switches to a session whose diagram loaded asynchronously).
  // We only sync UP — once draw.io reports a `save` event the local state is
  // trusted and we don't overwrite it from the prop.
  const lastSeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialXml) return;
    if (lastSeededRef.current === initialXml) return;
    lastSeededRef.current = initialXml;
    setGeneratedXML(initialXml);
  }, [initialXml]);

  // Step 4 — Architecture document
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [isPushingToConfluence, setIsPushingToConfluence] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [confluencePageUrl, setConfluencePageUrl] = useState("");


  // Diagram save/load (Confluence)
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);
  const [diagramPageUrl, setDiagramPageUrl] = useState("");
  const [diagramSaveTitle, setDiagramSaveTitle] = useState("");
  const [savedDiagramBanner, setSavedDiagramBanner] = useState<{ xml: string; page_url: string } | null>(null);

  // Edit mode — browse & edit saved diagrams
  const [viewMode, setViewMode] = useState<"create" | "edit">("create");
  const [editDiagrams, setEditDiagrams] = useState<DiagramPageInfo[]>([]);
  const [isLoadingEditDiagrams, setIsLoadingEditDiagrams] = useState(false);
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editingPageTitle, setEditingPageTitle] = useState("");
  const [editingPageUrl, setEditingPageUrl] = useState("");
  const [isLoadingEditXML, setIsLoadingEditXML] = useState(false);

  // Fullscreen state for the draw.io editor
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Left-panel collapse used to live here as local state. The new
  // PanelGroup-based layout owns sizing via drag, so we no longer need
  // a manual collapsed flag.

  // Which architectural view the prompt + diagram should target. Mirrors
  // the LucidDashboard picker so the two authoring tabs feel symmetric.
  // Switching view discards the prompt + downstream XML/document so the
  // user always reviews fresh content matched to the chosen view.
  // When `lockedDiagramType` is supplied (i.e. mounted inside the new
  // DiagramPhaseHost flow), the type is pinned and the in-component
  // picker is hidden — the hub already established the choice.
  const [diagramTypeState, setDiagramTypeState] = useState<DesignDiagramType>(
    lockedDiagramType ?? "infrastructure",
  );
  const diagramType = lockedDiagramType ?? diagramTypeState;
  const setDiagramType = (t: DesignDiagramType) => {
    if (lockedDiagramType) return; // ignored when locked — hub owns the choice
    setDiagramTypeState(t);
  };
  // Re-sync if the parent later passes a different locked type (e.g. user
  // closes editor and opens a different row).
  useEffect(() => {
    if (lockedDiagramType) setDiagramTypeState(lockedDiagramType);
  }, [lockedDiagramType]);

  // Snapshot of create-mode state — preserved when switching to edit mode
  const createSnapshot = useRef({
    generatedPrompt: '',
    generatedXML: '',
    generatedDocument: '',
    documentTitle: '',
    confluencePageUrl: '',
    diagramPageUrl: '',
    diagramSaveTitle: '',
  });

  // Snapshot of edit-mode state — preserved when switching to create mode
  const editSnapshot = useRef({
    generatedXML: '',
    generatedDocument: '',
    documentTitle: '',
    confluencePageUrl: '',
    editingPageTitle: '',
    editingPageUrl: '',
  });

  // draw.io embed iframe ref
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Track whether the iframe has fired its first "init" — only then can we push XML directly
  const iframeReadyRef = useRef(false);

  // Flag: XML change originated from draw.io itself — skip re-sending to iframe
  const isXmlFromDrawioRef = useRef(false);

  // Stable refs for values needed inside the draw.io message handler (avoids stale closures)
  const viewModeRef = useRef(viewMode);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const editingPageTitleRef = useRef(editingPageTitle);
  useEffect(() => { editingPageTitleRef.current = editingPageTitle; }, [editingPageTitle]);

  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => { selectedProjectRef.current = selectedProject; }, [selectedProject]);

  const confluenceSpaceKeyRef = useRef(confluenceSpaceKey);
  useEffect(() => { confluenceSpaceKeyRef.current = confluenceSpaceKey; }, [confluenceSpaceKey]);

  // postMessage bridge — send XML to draw.io on init, capture saves
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://embed.diagrams.net") return;
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.event === "init") {
        iframeReadyRef.current = true;
        // draw.io is ready — send current XML
        const source = event.source as Window | null;
        source?.postMessage(
          JSON.stringify({ action: "load", xml: generatedXML }),
          "https://embed.diagrams.net"
        );
      }

      if (data.event === "save" && data.xml) {
        // Mark that this XML change came from draw.io so we don't reload the iframe
        isXmlFromDrawioRef.current = true;
        setGeneratedXML(data.xml);
        // Acknowledge the save so draw.io clears the "unsaved" indicator
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ action: "status", modified: false }),
          "https://embed.diagrams.net"
        );

        // In Edit mode: auto-save the updated XML back to Confluence immediately
        if (
          viewModeRef.current === "edit" &&
          editingPageTitleRef.current &&
          selectedProjectRef.current &&
          confluenceSpaceKeyRef.current
        ) {
          saveDiagramToConfluence(
            selectedProjectRef.current.id,
            confluenceSpaceKeyRef.current,
            data.xml,
            editingPageTitleRef.current,
          )
            .then(() => {
              toast({ title: "Saved to Confluence", description: `"${editingPageTitleRef.current}" updated.` });
            })
            .catch((err: any) => {
              toast({ title: "Auto-save failed", description: err.message, variant: "destructive" });
            });
        } else {
          toast({ title: "Diagram updated", description: "Changes captured — click Save to persist to Confluence." });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [generatedXML]);

  // Reset the prompt + downstream artifacts when the user picks a
  // different architectural view. The three views need three different
  // prompts, so any in-flight content is stale once the type changes.
  // Mirrors the LucidDashboard equivalent.
  useEffect(() => {
    setGeneratedPrompt("");
    setGeneratedXML("");
    setGeneratedDocument("");
    // We deliberately don't list the setters in deps — they're stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramType]);

  // Whenever XML changes AND the iframe is already ready, push the new XML immediately.
  // Skip if the change originated from draw.io itself (avoids a reload loop).
  useEffect(() => {
    if (!generatedXML || !iframeReadyRef.current) return;
    if (isXmlFromDrawioRef.current) {
      isXmlFromDrawioRef.current = false;
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml: generatedXML }),
      "https://embed.diagrams.net"
    );
  }, [generatedXML]);

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadPages = async (spaceKey: string) => {
    if (!accessToken) return;
    setIsLoadingPages(true);
    setPages([]);
    setSelectedPageIds(new Set());
    try {
      const result = await fetchConfluencePages(accessToken, spaceKey);
      setPages(result);
      if (result.length === 0) {
        toast({ title: "No pages found", description: `No pages found in Confluence space "${spaceKey}".` });
      }
    } catch (error: any) {
      toast({ title: "Failed to load pages", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingPages(false);
    }
  };

  // Auto-load pages whenever the selected project's Confluence space changes
  useEffect(() => {
    if (confluenceSpaceKey && accessToken) {
      loadPages(confluenceSpaceKey);
    } else {
      setPages([]);
      setSelectedPageIds(new Set());
    }
  }, [confluenceSpaceKey, accessToken]);

  // Reset all design state when the project changes
  useEffect(() => {
    // Clear Create mode state
    setGeneratedPrompt("");
    // Session mode owns the XML — don't blank it on project-change, the
    // session-aware parent re-seeds via `initialXml`. Clearing here would
    // race with the parent and blank the diagram editor (the user
    // saw "Select Confluence pages" appear after switching sessions).
    if (initialXml === undefined) {
      setGeneratedXML("");
    } else {
      setGeneratedXML(initialXml);
    }
    setGeneratedDocument("");
    setDocumentTitle("");
    setConfluencePageUrl("");
    setDiagramPageUrl("");
    setDiagramSaveTitle("");
    setSelectedPageIds(new Set());
    // Clear Edit mode state
    setEditDiagrams([]);
    setEditingPageTitle("");
    setEditingPageUrl("");
    setEditSearchQuery("");
    // Reset snapshots
    createSnapshot.current = { generatedPrompt: '', generatedXML: '', generatedDocument: '', documentTitle: '', confluencePageUrl: '', diagramPageUrl: '', diagramSaveTitle: '' };
    editSnapshot.current = { generatedXML: '', generatedDocument: '', documentTitle: '', confluencePageUrl: '', editingPageTitle: '', editingPageUrl: '' };
    // Reset iframe tracking
    iframeReadyRef.current = false;
    // If in edit mode, refresh the diagram list for the new project
    if (viewMode === "edit" && confluenceSpaceKey && selectedProject) {
      loadEditDiagrams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  // Auto-check for a saved diagram when project changes — Confluence-only
  // probe. Skipped in session mode (initialXml provided) since the parent
  // already loaded the session's XML from S3, which is the source of truth.
  useEffect(() => {
    setSavedDiagramBanner(null);
    setDiagramPageUrl("");
    if (initialXml !== undefined) return;
    if (!confluenceSpaceKey || !selectedProject) return;
    loadDiagramFromConfluence(selectedProject.id, confluenceSpaceKey)
      .then((result) => {
        if (result) setSavedDiagramBanner({ xml: result.xml, page_url: result.page_url });
      })
      .catch(() => {}); // silent — no saved diagram is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confluenceSpaceKey, selectedProject?.id]);

  // True whenever any async operation is in flight — blocks page selection
  const isProcessing = isGeneratingPrompt || isGeneratingXML || isGeneratingDocument || isSavingDiagram || isPushingToConfluence;

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
    if (selectedPageIds.size === filteredPages.length && filteredPages.length > 0) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(filteredPages.map((p) => p.id)));
    }
  };

  const handleGeneratePrompt = async () => {
    if (selectedPageIds.size === 0) {
      toast({ title: "No pages selected", description: "Please select at least one Confluence page.", variant: "destructive" });
      return;
    }
    if (!accessToken) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }
    setIsGeneratingPrompt(true);
    try {
      const contentPromises = Array.from(selectedPageIds).map((id) =>
        fetchConfluencePageDetails(id, accessToken).then((details) => {
          const plainText = details.body.storage.value
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return `## ${details.title}\n\n${plainText}`;
        })
      );
      const pageContents = await Promise.all(contentPromises);
      setGeneratedPrompt('');
      setGeneratedXML('');
      setGeneratedDocument('');
      await generateArchitecturePromptStream(
        pageContents,
        (text) => setGeneratedPrompt(prev => prev + text),
        diagramType,
      );
      toast({ title: "Prompt generated", description: "Review the sections below, then generate the diagram." });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateXML = async () => {
    if (!generatedPrompt.trim()) {
      toast({ title: "No prompt", description: "Generate or write an architecture prompt first.", variant: "destructive" });
      return;
    }
    setIsGeneratingXML(true);
    try {
      const xml = await generateDrawioXML(generatedPrompt);
      setGeneratedXML(xml);
      setGeneratedDocument('');
      // Name the diagram from the selected BRD page title(s) — ensures each BRD gets its own Confluence page
      const selectedPages = pages.filter(p => selectedPageIds.has(p.id));
      let diagramBase = '';
      if (selectedPages.length === 1) {
        // Single BRD — use its title, strip "BRD - " prefix and trailing date if present
        diagramBase = selectedPages[0].title
          .replace(/^BRD\s*[-–]\s*/i, '')
          .replace(/\s*[-–]\s*\d{4}-\d{2}-\d{2}.*$/i, '')
          .trim();
      } else if (selectedPages.length > 1) {
        // Multiple BRDs — use the project name from the prompt
        const nameMatch = generatedPrompt.match(/Name:\s+(.+)/);
        diagramBase = nameMatch?.[1]?.trim() || selectedProject?.project_name || confluenceSpaceKey || 'Diagram';
      } else {
        diagramBase = selectedProject?.project_name || confluenceSpaceKey || 'Diagram';
      }
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setDiagramSaveTitle(`Architecture Diagram — ${diagramBase} — ${ts}`);
      toast({ title: "XML generated", description: "draw.io XML is ready to download." });
    } catch (error: any) {
      const isTimeout = /timeout|timed out/i.test(error.message);
      toast({
        title: isTimeout ? "Generation timed out" : "XML generation failed",
        description: isTimeout
          ? "The AI model took too long to respond. Please try again."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingXML(false);
    }
  };

  const handleGenerateDocument = async () => {
    if (isGeneratingDocument) return; // prevent re-entry
    if (!generatedXML) {
      toast({ title: "No diagram", description: "Generate a draw.io XML diagram first.", variant: "destructive" });
      return;
    }
    if (generatedDocument && !window.confirm("This will overwrite the current document. Continue?")) return;
    setIsGeneratingDocument(true);
    setConfluencePageUrl("");
    setGeneratedDocument('');
    const promptContext = generatedPrompt.trim() || editingPageTitle || "Generate architecture documentation for this system.";
    try {
      await generateArchitectureDocumentStream(generatedXML, promptContext, (text) => {
        setGeneratedDocument(prev => prev + text);
      });
      // Set title from first heading once complete
      setGeneratedDocument(prev => {
        const firstHeading = prev.match(/^#\s+(.+)$/m);
        const defaultTitle = editingPageTitle ? `${editingPageTitle} — Document` : "Architecture Document";
        setDocumentTitle(firstHeading ? firstHeading[1].trim() : defaultTitle);
        return prev;
      });
      toast({ title: "Document generated", description: "Architecture document is ready to download or push to Confluence." });
    } catch (error: any) {
      toast({ title: "Document generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  const handleDownloadDocument = () => {
    if (!generatedDocument) return;
    const blob = new Blob([generatedDocument], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture-document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePushToConfluence = async () => {
    if (!generatedDocument || !confluenceSpaceKey) return;
    if (!selectedProject) return;
    setIsPushingToConfluence(true);
    try {
      const result = await pushDocumentToConfluence(
        selectedProject.id,
        confluenceSpaceKey,
        documentTitle,
        generatedDocument,
      );
      setConfluencePageUrl(result.page_url);
      toast({ title: "Pushed to Confluence", description: `Page created: "${documentTitle}"` });
    } catch (error: any) {
      toast({ title: "Failed to push to Confluence", description: error.message, variant: "destructive" });
    } finally {
      setIsPushingToConfluence(false);
    }
  };

  const loadEditDiagrams = async () => {
    if (!confluenceSpaceKey || !selectedProject) return;
    setIsLoadingEditDiagrams(true);
    try {
      const diagrams = await listSavedDiagrams(selectedProject.id, confluenceSpaceKey);
      setEditDiagrams(diagrams);
    } catch (error: any) {
      toast({ title: "Failed to load diagrams", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingEditDiagrams(false);
    }
  };

  const handleEnterEditMode = () => {
    // Save create-mode state before switching
    createSnapshot.current = {
      generatedPrompt,
      generatedXML,
      generatedDocument,
      documentTitle,
      confluencePageUrl,
      diagramPageUrl,
      diagramSaveTitle,
    };
    // Restore edit-mode state
    setGeneratedXML(editSnapshot.current.generatedXML);
    setGeneratedDocument(editSnapshot.current.generatedDocument);
    setDocumentTitle(editSnapshot.current.documentTitle);
    setConfluencePageUrl(editSnapshot.current.confluencePageUrl);
    setEditingPageTitle(editSnapshot.current.editingPageTitle);
    setEditingPageUrl(editSnapshot.current.editingPageUrl);
    iframeReadyRef.current = false;
    setViewMode("edit");
    loadEditDiagrams();
  };

  const handleEnterCreateMode = () => {
    // Save edit-mode state before switching
    editSnapshot.current = {
      generatedXML,
      generatedDocument,
      documentTitle,
      confluencePageUrl,
      editingPageTitle,
      editingPageUrl,
    };
    // Restore create-mode state
    setGeneratedPrompt(createSnapshot.current.generatedPrompt);
    setGeneratedXML(createSnapshot.current.generatedXML);
    setGeneratedDocument(createSnapshot.current.generatedDocument);
    setDocumentTitle(createSnapshot.current.documentTitle);
    setConfluencePageUrl(createSnapshot.current.confluencePageUrl);
    setDiagramPageUrl(createSnapshot.current.diagramPageUrl);
    setDiagramSaveTitle(createSnapshot.current.diagramSaveTitle);
    iframeReadyRef.current = false;
    setViewMode("create");
  };

  const handleSelectEditDiagram = async (diagram: DiagramPageInfo) => {
    if (!selectedProject || !confluenceSpaceKey) return;
    setIsLoadingEditXML(true);
    setEditingPageTitle(diagram.title);
    setEditingPageUrl(diagram.page_url);
    setGeneratedDocument("");
    try {
      const result = await loadDiagramFromConfluence(selectedProject.id, confluenceSpaceKey, diagram.title, diagram.page_id);
      if (result) {
        setGeneratedXML(result.xml);
      } else {
        toast({ title: "Could not load diagram", description: "XML not found in that page.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to load diagram", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingEditXML(false);
    }
  };

  const handleSaveEditDiagram = async () => {
    if (!generatedXML || !confluenceSpaceKey || !selectedProject || !editingPageTitle) return;
    setIsSavingDiagram(true);
    try {
      const result = await saveDiagramToConfluence(selectedProject.id, confluenceSpaceKey, generatedXML, editingPageTitle);
      setEditingPageUrl(result.page_url);
      toast({ title: "Changes saved", description: `"${editingPageTitle}" updated in Confluence.` });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingDiagram(false);
    }
  };

  const handleSaveDiagram = async () => {
    if (!generatedXML || !confluenceSpaceKey || !selectedProject) return;
    setIsSavingDiagram(true);
    try {
      const result = await saveDiagramToConfluence(selectedProject.id, confluenceSpaceKey, generatedXML, diagramSaveTitle || undefined);
      setDiagramPageUrl(result.page_url);
      setSavedDiagramBanner(null); // clear the "load" banner after saving
      toast({ title: "Diagram saved to Confluence", description: "You can reload it next time you open this project." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingDiagram(false);
    }
  };

  const handleDownloadXML = () => {
    if (!generatedXML) return;
    const blob = new Blob([generatedXML], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture-diagram.drawio";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Step completion helpers
  const step1Done = selectedPageIds.size > 0;
  const step2Done = !!generatedPrompt;
  const step3Done = !!generatedXML;
  const step4Done = !!generatedDocument;

  // Resolved active step — used by the editorial progress strip in the
  // legacy (non-session) route. In session mode the header chrome is
  // hidden so this never paints, but we keep it computed for parity.
  const stepFlags = [
    { label: "Pages · Mark", done: step1Done },
    { label: "Brief · Review", done: step2Done },
    { label: "Diagram · Draft", done: step3Done },
    { label: "Document · Issue", done: step4Done },
  ];

  return (
    <div
      className={cn(
        "design-surface flex flex-col overflow-hidden",
        hideDocumentSteps ? "h-full" : "h-[calc(100vh-4rem)]",
      )}
    >

      {/* ── Plate header — hidden in session mode ── */}
      {!hideDocumentSteps && (
        <div
          className="px-6 sm:px-8 py-4 flex items-center justify-between border-b"
          style={{ borderColor: "hsl(var(--design-rule-strong))" }}
        >
          <div>
            <div className="design-eyebrow">Drafting · Design Assistant</div>
            <h1
              className="design-heading mt-1"
              style={{ fontSize: "1.4rem" }}
            >
              Architecture diagrams & documents from Confluence
            </h1>
          </div>

          {/* Mode toggle — editorial plate-tab pair */}
          <div
            className="flex items-center gap-0 border-l border-r"
            style={{ borderColor: "hsl(var(--design-rule))" }}
          >
            <button
              type="button"
              onClick={handleEnterCreateMode}
              className="design-tab"
              data-active={viewMode === "create"}
            >
              <PlusCircle className="w-3 h-3 mr-1.5 inline-block align-text-bottom" />
              Create
            </button>
            <button
              type="button"
              onClick={handleEnterEditMode}
              className="design-tab"
              data-active={viewMode === "edit"}
            >
              <Pencil className="w-3 h-3 mr-1.5 inline-block align-text-bottom" />
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Plate progress strip — also hidden in session mode ── */}
      {!hideDocumentSteps && (
        <div
          className="flex items-stretch border-b"
          style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
        >
          {(() => {
            const activeIdx = stepFlags.findIndex((s) => !s.done);
            return stepFlags.map((s, i) => {
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
                    <ChevronDown
                      className="w-3 h-3 ml-auto rotate-[-90deg]"
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
            });
          })()}
        </div>
      )}

      {/* ══ EDIT MODE ══
       * Browse + edit previously-saved diagrams in Confluence. Visible
       * only at the legacy /design-assistant route (not in session flow,
       * which always passes hideDocumentSteps=true so the mode toggle
       * isn't reachable anyway). */}
      {viewMode === "edit" && (
        <PanelGroup
          direction="horizontal"
          autoSaveId="design-drawio-edit-panels"
          className="flex-1 min-h-0"
        >

          {/* Left — saved diagram list (tier 2 surface) */}
          <Panel defaultSize={36} minSize={22} maxSize={55}>
            <div className="h-full flex flex-col p-5 overflow-hidden bg-[hsl(var(--surface-panel))] border-r border-[hsl(var(--border-zone))]">
              <div className="flex items-baseline justify-between mb-3 flex-shrink-0">
                <div>
                  <div className="design-eyebrow">Plate · 02 — Edit · Library</div>
                  <h3 className="design-heading mt-0.5" style={{ fontSize: "1.05rem" }}>
                    Saved diagrams
                  </h3>
                </div>
                <button
                  onClick={loadEditDiagrams}
                  disabled={isLoadingEditDiagrams}
                  className="design-btn-ghost"
                  style={{ padding: "0.3rem 0.5rem" }}
                  title="Refresh list"
                >
                  {isLoadingEditDiagrams ? (
                    <div
                      className="w-3 h-3 animate-spin rounded-full border-2"
                      style={{
                        borderColor: "currentColor",
                        borderTopColor: "transparent",
                      }}
                    />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Cartouche identifying the space */}
              {confluenceSpaceKey && (
                <div className="design-cartouche mb-3 self-start">
                  <span className="design-cartouche__field-label">space</span>
                  <span className="design-cartouche__divider">·</span>
                  <span className="design-cartouche__field-value">{confluenceSpaceKey}</span>
                  {selectedProject?.project_name && (
                    <>
                      <span className="design-cartouche__divider">·</span>
                      <span
                        className="design-cartouche__field-value truncate"
                        style={{ maxWidth: "9rem" }}
                      >
                        {selectedProject.project_name}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Search */}
              {editDiagrams.length > 0 && (
                <input
                  value={editSearchQuery}
                  onChange={(e) => setEditSearchQuery(e.target.value)}
                  placeholder="Filter saved diagrams…"
                  className="design-chat-input mb-3 flex-shrink-0"
                  style={{ fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}
                />
              )}

              {/* Diagram list */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isLoadingEditDiagrams ? (
                  <div className="flex items-center justify-center py-12 gap-2">
                    <div
                      className="w-4 h-4 animate-spin rounded-full border-2"
                      style={{
                        borderColor: "hsl(var(--design-mark))",
                        borderTopColor: "transparent",
                      }}
                    />
                    <span
                      className="design-mono"
                      style={{
                        fontSize: "0.72rem",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "hsl(var(--design-ink-muted))",
                      }}
                    >
                      Loading diagrams…
                    </span>
                  </div>
                ) : editDiagrams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
                    <FileText
                      className="w-7 h-7"
                      style={{ color: "hsl(var(--design-rule))" }}
                    />
                    <p
                      className="design-marginalia"
                      style={{ fontSize: "0.82rem", maxWidth: "16rem" }}
                    >
                      No saved diagrams found in this space. Draft one in Create mode and save it first.
                    </p>
                  </div>
                ) : (
                  editDiagrams
                    .filter((d) => d.title.toLowerCase().includes(editSearchQuery.toLowerCase()))
                    .map((diagram) => (
                      <button
                        key={diagram.page_id}
                        onClick={() => !isLoadingEditXML && handleSelectEditDiagram(diagram)}
                        disabled={isLoadingEditXML}
                        className="design-row"
                        data-active={editingPageTitle === diagram.title}
                        style={isLoadingEditXML ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                      >
                        <FileText
                          className="w-3.5 h-3.5 flex-shrink-0 mt-[3px]"
                          style={{ color: "hsl(var(--design-ink-muted))" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="truncate"
                            style={{
                              fontSize: "0.85rem",
                              color: "hsl(var(--design-ink))",
                            }}
                          >
                            {diagram.title}
                          </p>
                          {diagram.last_modified && (
                            <p
                              className="design-mono mt-0.5 flex items-center gap-1"
                              style={{
                                fontSize: "0.65rem",
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "hsl(var(--design-ink-muted))",
                              }}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(diagram.last_modified).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="design-resize-handle" />

          {/* Right — diagram editor (adaptive) */}
          <Panel defaultSize={64} minSize={45}>
          <div className="h-full flex flex-col overflow-y-auto">

            {/* ── Empty / loading state ── */}
            {!generatedXML && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-24 px-8 gap-3">
                {isLoadingEditXML ? (
                  <>
                    <div className="w-10 h-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm text-gray-500">Loading diagram...</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 bg-primary/[6%]">
                      <Pencil className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-base font-medium text-gray-600">Select a diagram to edit</p>
                    <p className="text-sm text-gray-400 max-w-xs">Click any saved diagram on the left to load it into the editor.</p>
                  </>
                )}
              </div>
            )}

            {/* ── DIAGRAM VIEW (loaded, no document yet) ── */}
            {generatedXML && !generatedDocument && (
              <div className="flex flex-col h-full p-5 gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-primary">
                      <Pencil className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold truncate max-w-xs text-[#1a1a1a]">{editingPageTitle}</p>
                      <p className="text-xs text-gray-400">Edit directly in draw.io, then save or generate a document</p>
                    </div>
                  </div>
                  {editingPageUrl && (
                    <a href={editingPageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 flex-shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />View in Confluence
                    </a>
                  )}
                </div>

                {/* draw.io iframe — fills remaining space */}
                <div
                  className={cn(
                    isFullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : "flex-1 relative border border-gray-200 rounded-xl overflow-hidden",
                    !isFullscreen && "min-h-[420px]"
                  )}
                >
                  {/* Loading overlay — shown while fetching a new diagram from Confluence */}
                  {isLoadingEditXML && (
                    <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
                      <p className="text-sm font-medium text-gray-600">Loading diagram…</p>
                      <p className="text-xs text-gray-400">{editingPageTitle}</p>
                    </div>
                  )}
                  {isFullscreen && (
                    <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
                      <span className="text-sm font-semibold">{editingPageTitle}</span>
                      <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)} className="gap-1.5 text-xs">
                        <Minimize2 className="w-3.5 h-3.5" />Exit Full Screen
                      </Button>
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    src="https://embed.diagrams.net/?embed=1&spin=1&proto=json&saveAndExit=0&noSaveBtn=0"
                    className={isFullscreen ? "flex-1 w-full border-0" : "w-full h-full border-0"}
                    title="Architecture Diagram Editor"
                  />
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="text-xs gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />Full Screen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadXML} className="text-xs gap-1.5">
                    <Download className="w-3.5 h-3.5" />Download XML
                  </Button>
                  <Button
                    variant="outline" size="sm" className="text-xs gap-1.5"
                    onClick={handleSaveEditDiagram} disabled={isSavingDiagram}
                  >
                    {isSavingDiagram
                      ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</>
                      : <><FileText className="w-3.5 h-3.5" />Save Changes</>}
                  </Button>
                  {!hideDocumentSteps && (
                    <Button
                      size="sm" className="text-xs gap-1.5 text-white bg-violet-500"
                      onClick={handleGenerateDocument} disabled={isGeneratingDocument}
                    >
                      {isGeneratingDocument
                        ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating...</>
                        : <><BookText className="w-3.5 h-3.5" />Generate Document</>}
                    </Button>
                  )}
                </div>

                {diagramPageUrl && (
                  <a href={diagramPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />View saved diagram in Confluence
                  </a>
                )}
              </div>
            )}

            {/* ── DOCUMENT VIEW (document generated) ── */}
            {generatedXML && generatedDocument && (
              <div className="flex flex-col h-full p-5 gap-4">

                {/* Collapsed diagram accordion */}
                <details className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-600">
                      <Pencil className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-600 flex-1 truncate">{editingPageTitle}</span>
                    <div className="flex items-center gap-2 mr-2">
                      <button onClick={(e) => { e.preventDefault(); setIsFullscreen(true); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5" />Fullscreen
                      </button>
                      <button onClick={(e) => { e.preventDefault(); handleSaveEditDiagram(); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />Save
                      </button>
                      <button onClick={(e) => { e.preventDefault(); handleDownloadXML(); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />Download
                      </button>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
                  </summary>
                  <div className="border-t border-gray-100">
                    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : ""}>
                      {isFullscreen && (
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
                          <span className="text-sm font-semibold">{editingPageTitle}</span>
                          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)} className="gap-1.5 text-xs">
                            <Minimize2 className="w-3.5 h-3.5" />Exit Full Screen
                          </Button>
                        </div>
                      )}
                      <iframe
                        ref={iframeRef}
                        src="https://embed.diagrams.net/?embed=1&spin=1&proto=json&saveAndExit=0&noSaveBtn=0"
                        className={cn(isFullscreen ? "flex-1 w-full border-0" : "w-full border-0", !isFullscreen && "h-[300px]")}
                        title="Architecture Diagram Editor"
                      />
                    </div>
                  </div>
                </details>

                {/* Document header */}
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-green-600">4</div>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">Architecture Document</p>
                    <p className="text-xs text-gray-400">Download as Markdown or push to Confluence</p>
                  </div>
                </div>

                {/* Document textarea */}
                <Textarea
                  value={generatedDocument}
                  onChange={(e) => setGeneratedDocument(e.target.value)}
                  className="flex-1 text-sm font-mono resize-none min-h-[260px]"
                />

                {/* Export actions */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Confluence page title:</label>
                    <Input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} className="h-8 text-sm flex-1" placeholder="Architecture Document" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleDownloadDocument}>
                      <Download className="w-4 h-4 mr-2" />Download .md
                    </Button>
                    <Button className="flex-1 text-white bg-primary" onClick={handlePushToConfluence} disabled={isPushingToConfluence || !confluenceSpaceKey}>
                      {isPushingToConfluence
                        ? <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Pushing...</>
                        : <><FileText className="w-4 h-4 mr-2" />Push to Confluence</>}
                    </Button>
                  </div>
                  {confluencePageUrl && (
                    <a href={confluencePageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />View page in Confluence
                    </a>
                  )}
                </div>

                {/* Regenerate document */}
                <Button size="sm" variant="outline" className="text-xs gap-1.5 w-full" onClick={handleGenerateDocument} disabled={isGeneratingDocument}>
                  {isGeneratingDocument
                    ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Regenerating...</>
                    : <><RefreshCw className="w-3.5 h-3.5" />Regenerate Document</>}
                </Button>
              </div>
            )}
          </div>
          </Panel>
        </PanelGroup>
      )}

      {/* ══ CREATE MODE ══ */}
      {viewMode === "create" && (
      <PanelGroup
        direction="horizontal"
        autoSaveId="design-drawio-create-panels"
        className="flex-1 min-h-0"
      >

        {/* ══ LEFT PANEL — Plate · 01 · Page selector (tier 2 surface) ══ */}
        <Panel defaultSize={28} minSize={18} maxSize={45}>
        <div className="h-full flex flex-col px-5 py-4 overflow-hidden bg-[hsl(var(--surface-panel))] border-r border-[hsl(var(--border-zone))]">

          {/* Panel header */}
          <div className="flex items-baseline justify-between mb-3 flex-shrink-0">
            <div>
              <div className="design-eyebrow">Plate · 01 — Intake</div>
              <h3 className="design-heading mt-0.5" style={{ fontSize: "1.05rem" }}>
                Confluence pages
              </h3>
            </div>
            {confluenceSpaceKey && (
              <button
                onClick={() => loadPages(confluenceSpaceKey)}
                disabled={isLoadingPages}
                className="design-btn-ghost"
                style={{ padding: "0.3rem 0.5rem" }}
                title="Reload pages"
              >
                {isLoadingPages ? (
                  <div
                    className="w-3 h-3 animate-spin rounded-full border-2"
                    style={{
                      borderColor: "currentColor",
                      borderTopColor: "transparent",
                    }}
                  />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Cartouche identifying the space */}
          {confluenceSpaceKey ? (
            <div className="design-cartouche mb-3 self-start">
              <span className="design-cartouche__field-label">space</span>
              <span className="design-cartouche__divider">·</span>
              <span className="design-cartouche__field-value">{confluenceSpaceKey}</span>
              {selectedProject?.project_name && (
                <>
                  <span className="design-cartouche__divider">·</span>
                  <span
                    className="design-cartouche__field-value truncate"
                    style={{ maxWidth: "9rem" }}
                  >
                    {selectedProject.project_name}
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
              {selectedProject
                ? `No Confluence space configured for "${selectedProject.project_name}".`
                : "Pick a project first."}
            </div>
          )}

          {/* Search */}
          {pages.length > 0 && (
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter pages…"
              className="design-chat-input mb-3 flex-shrink-0"
              style={{ fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}
            />
          )}

          {/* Page list */}
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
                  {!selectedProject
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
                      isProcessing && "opacity-40 cursor-not-allowed",
                    )}
                    style={{
                      fontSize: "0.65rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "hsl(var(--design-ink-muted))",
                    }}
                  >
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0
                      ? <CheckSquare className="w-3 h-3" />
                      : <Square className="w-3 h-3" />}
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0
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
                          : isGeneratingXML
                          ? "Drafting diagram…"
                          : isGeneratingDocument
                          ? "Issuing document…"
                          : isSavingDiagram
                          ? "Saving diagram…"
                          : "Pushing to Confluence…"}
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
                          {checked
                            ? <CheckSquare
                                className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]"
                                style={{ color: "hsl(var(--design-mark))" }}
                              />
                            : <Square
                                className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]"
                                style={{ color: "hsl(var(--design-rule))" }}
                              />}
                          <FileText
                            className="w-3 h-3 flex-shrink-0 mt-[3px]"
                            style={{ color: "hsl(var(--design-ink-muted))" }}
                          />
                          <span
                            className="truncate"
                            style={{ fontSize: "0.85rem", color: "hsl(var(--design-ink))" }}
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

          {/* Generate Prompt CTA */}
          <div
            className="mt-3 pt-3 flex-shrink-0 border-t"
            style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
          >
            <button
              className="design-btn-mark w-full justify-center"
              onClick={handleGeneratePrompt}
              disabled={selectedPageIds.size === 0 || isGeneratingPrompt}
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
                  Composing
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate Architecture Prompt
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
        </Panel>

        <PanelResizeHandle className="design-resize-handle" />

        {/* ══ RIGHT PANEL — adaptive per drafting step ══ */}
        <Panel defaultSize={72} minSize={50}>
        <div className="h-full flex flex-col min-h-0 overflow-y-auto">

          {/* ── Diagram-type picker ──
           * Visible only while drafting. Once the diagram exists (step3),
           * we hide the picker — switching now would discard committed
           * work. Selecting a different type clears prompt + XML so the
           * user always reviews fresh content matched to the choice. */}
          {/* Picker hidden when the hub-driven flow has locked the type —
           * the choice was made one screen up. P4: one decision per surface. */}
          {!step3Done && !lockedDiagramType && (
            <div className="px-5 pt-5">
              <DiagramTypePicker
                active={diagramType}
                onPick={setDiagramType}
                disabled={isProcessing}
              />
            </div>
          )}

          {/* ── Saved diagram banner ── */}
          {savedDiagramBanner && !step3Done && (
            <div
              className="mx-5 mt-5 flex items-center justify-between gap-3 px-4 py-3 design-plate"
              style={{ background: "hsl(var(--design-paper-warm))" }}
            >
              <div
                className="flex items-center gap-2 design-marginalia"
                style={{ fontSize: "0.85rem", color: "hsl(var(--design-ink))" }}
              >
                <Download
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "hsl(var(--design-mark))" }}
                />
                <span>A saved diagram exists for this project.</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={savedDiagramBanner.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="design-mono flex items-center gap-1"
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "hsl(var(--design-ink-muted))",
                  }}
                >
                  <ExternalLink className="w-3 h-3" />View
                </a>
                <button
                  type="button"
                  className="design-btn-mark"
                  disabled={isLoadingDiagram}
                  onClick={() => {
                    setGeneratedXML(savedDiagramBanner.xml);
                    setDiagramPageUrl(savedDiagramBanner.page_url);
                    setSavedDiagramBanner(null);
                    toast({
                      title: "Diagram loaded",
                      description: "Your saved diagram has been loaded into the editor.",
                    });
                  }}
                >
                  Load
                </button>
                <button
                  onClick={() => setSavedDiagramBanner(null)}
                  className="text-base leading-none"
                  style={{ color: "hsl(var(--design-ink-muted))" }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* ── Empty state ──
           * Skip when XML is already loaded (e.g. session pre-seeded via
           * `initialXml`) — we go straight to the diagram view in that case.
           */}
          {!step2Done && !step3Done && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-24 px-8 gap-3">
              <Wand2
                className="w-10 h-10"
                style={{ color: "hsl(var(--design-rule))" }}
              />
              <div className="design-eyebrow">Awaiting intake</div>
              <h3 className="design-heading" style={{ fontSize: "1.15rem" }}>
                Mark pages, then compose the brief
              </h3>
              <p
                className="design-marginalia"
                style={{ fontSize: "0.88rem", maxWidth: "26rem" }}
              >
                Choose one or more Confluence pages on the left, then click{" "}
                <span className="design-mono">Generate Architecture Prompt</span>{" "}
                to begin.
              </p>
            </div>
          )}

          {/* ── PROMPT VIEW (step2Done, no diagram yet) ── */}
          {step2Done && !step3Done && (() => {
            const nameMatch = generatedPrompt.match(/Name:\s+(.+)/);
            const componentLines = (generatedPrompt.match(/COMPONENTS[\s\S]*?(?=\nCONTAINERS|\nCONNECTIONS|\nDIAGRAM|\n={3})/) ?.[0] ?? '').split('\n').filter(l => l.includes('|') && !/id\s*\|/.test(l) && l.trim());
            const connectionLines = (generatedPrompt.match(/CONNECTIONS[\s\S]*?(?=\nDIAGRAM|\nXML RULES|\n={3})/)?.[0] ?? '').split('\n').filter(l => l.includes('→') && l.trim());

            return (
              <div className="flex flex-col h-full p-5 gap-3">

                {/* Header */}
                <div className="flex items-baseline justify-between gap-3 flex-shrink-0">
                  <div className="min-w-0">
                    <div className="design-eyebrow">Plate · 02 — Prompt</div>
                    <h3
                      className="design-heading mt-0.5"
                      style={{ fontSize: "1.1rem" }}
                    >
                      {DRAWIO_TYPES.find((t) => t.key === diagramType)?.title} ·{" "}
                      {DRAWIO_TYPES.find((t) => t.key === diagramType)?.subtitle}
                    </h3>
                    <p
                      className="design-marginalia mt-0.5"
                      style={{ fontSize: "0.78rem" }}
                    >
                      {isGeneratingPrompt
                        ? "Generating…"
                        : "Hand-tune any line, then draft the diagram."}
                    </p>
                  </div>
                  {isGeneratingPrompt && (
                    <div
                      className="w-4 h-4 animate-spin rounded-full border-2 flex-shrink-0"
                      style={{
                        borderColor: "hsl(var(--design-mark))",
                        borderTopColor: "transparent",
                      }}
                    />
                  )}
                </div>

                {/* Compact metadata cartouches */}
                {(nameMatch || componentLines.length > 0) && (
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {nameMatch && (
                      <span className="design-cartouche">
                        <span className="design-cartouche__field-label">name</span>
                        <span className="design-cartouche__divider">·</span>
                        <span
                          className="design-cartouche__field-value truncate"
                          style={{ maxWidth: "200px" }}
                        >
                          {nameMatch[1].trim()}
                        </span>
                      </span>
                    )}
                    {componentLines.length > 0 && (
                      <span className="design-cartouche">
                        <span className="design-cartouche__field-value">{componentLines.length}</span>
                        <span className="design-cartouche__field-label">components</span>
                      </span>
                    )}
                    {connectionLines.length > 0 && (
                      <span className="design-cartouche">
                        <span className="design-cartouche__field-value">{connectionLines.length}</span>
                        <span className="design-cartouche__field-label">connections</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Editable prompt textarea */}
                <textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="design-chat-input flex-1"
                  style={{
                    fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    fontSize: "0.78rem",
                    lineHeight: 1.6,
                    minHeight: "300px",
                  }}
                  placeholder="Composing architecture brief…"
                  spellCheck={false}
                />

                {/* Action buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="design-btn-ghost"
                    onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                  >
                    <Code2 className="w-3 h-3" />
                    Copy
                  </button>
                  <button
                    type="button"
                    className="design-btn-ghost"
                    onClick={() => setGeneratedPrompt("")}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear
                  </button>
                  <button
                    type="button"
                    className="design-btn-mark flex-1 justify-center"
                    onClick={handleGenerateXML}
                    disabled={!generatedPrompt.trim() || isGeneratingXML || isGeneratingPrompt}
                  >
                    {isGeneratingXML ? (
                      <>
                        <div
                          className="w-3 h-3 animate-spin rounded-full border-2"
                          style={{
                            borderColor: "currentColor",
                            borderTopColor: "transparent",
                          }}
                        />
                        Drafting
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" />
                        Draft Diagram
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── DIAGRAM VIEW (step3Done) ── */}
          {step3Done && !step4Done && (
            <div className="flex flex-col h-full p-5 gap-4">
              {/* Collapsed brief accordion */}
              <details
                className="group overflow-hidden border-l-2"
                style={{
                  borderColor: "hsl(var(--design-emerald))",
                  background: "hsl(var(--design-paper-deep))",
                }}
              >
                <summary
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none"
                  style={{ background: "hsl(var(--design-paper-deep))" }}
                >
                  <span
                    className="design-mono"
                    style={{
                      fontSize: "0.66rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "hsl(var(--design-emerald))",
                    }}
                  >
                    02
                  </span>
                  <span className="design-eyebrow flex-1">Architecture prompt — committed</span>
                  <span
                    className="design-marginalia mr-2"
                    style={{ fontSize: "0.74rem" }}
                  >
                    open to amend
                  </span>
                  <ChevronDown
                    className="w-4 h-4 transition-transform group-open:rotate-180 flex-shrink-0"
                    style={{ color: "hsl(var(--design-ink-muted))" }}
                  />
                </summary>
                <div
                  className="px-4 pb-4 pt-2 border-t"
                  style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
                >
                  <textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    className="design-chat-input w-full"
                    style={{
                      fontFamily: "JetBrains Mono, ui-monospace, monospace",
                      fontSize: "0.78rem",
                      minHeight: "160px",
                    }}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="design-btn-mark mt-2 w-full justify-center"
                    onClick={handleGenerateXML}
                    disabled={!generatedPrompt.trim() || isGeneratingXML || isGeneratingDocument || isGeneratingPrompt}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-draft Diagram
                  </button>
                </div>
              </details>

              {/* Diagram header */}
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="design-eyebrow">Plate · 03 — Working drawing</div>
                  <h3 className="design-heading mt-0.5" style={{ fontSize: "1.1rem" }}>
                    Architecture diagram
                  </h3>
                  <p
                    className="design-marginalia mt-0.5"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Edit directly in the embedded draw.io drafting board.
                  </p>
                </div>
              </div>

              {/* Diagram iframe — fills remaining space */}
              <div
                className={cn(
                  "design-plate overflow-hidden",
                  isFullscreen ? "fixed inset-0 z-50 flex flex-col" : "flex-1",
                  !isFullscreen && "min-h-[420px]",
                )}
                style={
                  isFullscreen
                    ? { background: "hsl(var(--design-paper))" }
                    : undefined
                }
              >
                {isFullscreen && (
                  <div
                    className="flex items-center justify-between px-4 py-2 border-b shrink-0"
                    style={{ borderColor: "hsl(var(--design-rule-strong))" }}
                  >
                    <div>
                      <div className="design-eyebrow">Plate · 03 — Working drawing</div>
                      <h3 className="design-heading" style={{ fontSize: "1rem" }}>
                        Architecture diagram editor
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(false)}
                      className="design-btn-ghost"
                    >
                      <Minimize2 className="w-3 h-3" />
                      Exit
                    </button>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src="https://embed.diagrams.net/?embed=1&spin=1&proto=json&saveAndExit=0&noSaveBtn=0"
                  className={isFullscreen ? "flex-1 w-full border-0" : "w-full h-full border-0"}
                  title="Architecture Diagram Editor"
                />
              </div>

              {/* Confluence title input */}
              <div className="flex items-center gap-3">
                <span
                  className="design-eyebrow flex-shrink-0"
                  style={{ minWidth: "5rem" }}
                >
                  Title
                </span>
                <input
                  value={diagramSaveTitle}
                  onChange={(e) => setDiagramSaveTitle(e.target.value)}
                  placeholder="Diagram title in Confluence…"
                  className="design-chat-input flex-1"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.6rem" }}
                />
              </div>

              {/* Bottom action row — tier-1 with top zone-divider hairline.
                  Outline-crimson buttons read clearly on white canvas
                  (Stage 4 §3: secondary CTA on tier-1 = bg-card + border-primary). */}
              <div className="pt-3 border-t border-[hsl(var(--border-zone))] grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] hover:text-[hsl(var(--primary))] justify-center"
                  onClick={() => setIsFullscreen(true)}
                >
                  <Maximize2 className="w-3 h-3 mr-1.5" />
                  Full screen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] hover:text-[hsl(var(--primary))] justify-center"
                  onClick={handleDownloadXML}
                >
                  <Download className="w-3 h-3 mr-1.5" />
                  Download XML
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] hover:text-[hsl(var(--primary))] justify-center"
                  onClick={handleSaveDiagram}
                  disabled={isSavingDiagram || !confluenceSpaceKey}
                >
                  {isSavingDiagram ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Saving
                    </>
                  ) : (
                    <>
                      <FileText className="w-3 h-3 mr-1.5" />
                      Save to Confluence
                    </>
                  )}
                </Button>
                {!hideDocumentSteps && (
                  <button
                    type="button"
                    className="design-btn-mark justify-center"
                    onClick={handleGenerateDocument}
                    disabled={isGeneratingDocument || isGeneratingXML || isGeneratingPrompt}
                  >
                    {isGeneratingDocument ? (
                      <>
                        <div
                          className="w-3 h-3 animate-spin rounded-full border-2"
                          style={{
                            borderColor: "currentColor",
                            borderTopColor: "transparent",
                          }}
                        />
                        Issuing
                      </>
                    ) : (
                      <>
                        <BookText className="w-3 h-3" />
                        Issue Document
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Saved link */}
              {diagramPageUrl && (
                <a
                  href={diagramPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="design-mono flex items-center gap-2"
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "hsl(var(--design-mark))",
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  View saved diagram in Confluence
                </a>
              )}
            </div>
          )}

          {/* ── DOCUMENT VIEW (step4Done) ── */}
          {step4Done && (
            <div className="flex flex-col h-full p-5 gap-4">

              {/* Collapsed brief */}
              <CollapsedPlate
                plateNum="02"
                label="Architecture prompt — committed"
              >
                <textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="design-chat-input w-full"
                  style={{
                    fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    fontSize: "0.78rem",
                    minHeight: "120px",
                  }}
                  spellCheck={false}
                />
              </CollapsedPlate>

              {/* Collapsed diagram */}
              <details
                className="group overflow-hidden border-l-2"
                style={{
                  borderColor: "hsl(var(--design-emerald))",
                  background: "hsl(var(--design-paper-deep))",
                }}
              >
                <summary
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none"
                  style={{ background: "hsl(var(--design-paper-deep))" }}
                >
                  <span
                    className="design-mono"
                    style={{
                      fontSize: "0.66rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "hsl(var(--design-emerald))",
                    }}
                  >
                    03
                  </span>
                  <span className="design-eyebrow flex-1">Working drawing — committed</span>
                  <div className="flex items-center gap-2 mr-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setIsFullscreen(true);
                      }}
                      className="design-mono flex items-center gap-1"
                      style={{
                        fontSize: "0.66rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "hsl(var(--design-ink-muted))",
                      }}
                    >
                      <Maximize2 className="w-3 h-3" />Fullscreen
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDownloadXML();
                      }}
                      className="design-mono flex items-center gap-1"
                      style={{
                        fontSize: "0.66rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "hsl(var(--design-ink-muted))",
                      }}
                    >
                      <Download className="w-3 h-3" />Download
                    </button>
                  </div>
                  <ChevronDown
                    className="w-4 h-4 transition-transform group-open:rotate-180 flex-shrink-0"
                    style={{ color: "hsl(var(--design-ink-muted))" }}
                  />
                </summary>
                <div
                  className="border-t"
                  style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
                >
                  <div
                    className={
                      isFullscreen ? "fixed inset-0 z-50 flex flex-col" : ""
                    }
                    style={
                      isFullscreen
                        ? { background: "hsl(var(--design-paper))" }
                        : undefined
                    }
                  >
                    {isFullscreen && (
                      <div
                        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
                        style={{ borderColor: "hsl(var(--design-rule-strong))" }}
                      >
                        <h3 className="design-heading" style={{ fontSize: "1rem" }}>
                          Architecture diagram editor
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsFullscreen(false)}
                          className="design-btn-ghost"
                        >
                          <Minimize2 className="w-3 h-3" />
                          Exit
                        </button>
                      </div>
                    )}
                    <iframe
                      ref={iframeRef}
                      src="https://embed.diagrams.net/?embed=1&spin=1&proto=json&saveAndExit=0&noSaveBtn=0"
                      className={cn(
                        isFullscreen ? "flex-1 w-full border-0" : "w-full border-0",
                        !isFullscreen && "h-[300px]",
                      )}
                      title="Architecture Diagram Editor"
                    />
                  </div>
                </div>
              </details>

              {/* Document header */}
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="design-eyebrow">Plate · 04 — Document</div>
                  <h3 className="design-heading mt-0.5" style={{ fontSize: "1.1rem" }}>
                    Architecture document
                  </h3>
                  <p
                    className="design-marginalia mt-0.5"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Download as Markdown, or issue to Confluence.
                  </p>
                </div>
              </div>

              {/* Document textarea */}
              <textarea
                value={generatedDocument}
                onChange={(e) => setGeneratedDocument(e.target.value)}
                className="design-chat-input flex-1"
                style={{
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: "0.82rem",
                  lineHeight: 1.55,
                  minHeight: "260px",
                }}
                spellCheck={false}
              />

              {/* Page title + export actions */}
              <div
                className="design-plate p-3 space-y-3"
                style={{ background: "hsl(var(--design-paper-warm))" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="design-eyebrow flex-shrink-0"
                    style={{ minWidth: "9rem" }}
                  >
                    Confluence page title
                  </span>
                  <input
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="design-chat-input flex-1"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.6rem" }}
                    placeholder="Architecture Document"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="design-btn-ghost flex-1 justify-center"
                    onClick={handleDownloadDocument}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .md
                  </button>
                  <button
                    type="button"
                    className="design-btn-mark flex-1 justify-center"
                    onClick={handlePushToConfluence}
                    disabled={isPushingToConfluence || !confluenceSpaceKey}
                  >
                    {isPushingToConfluence ? (
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
                        <FileText className="w-3.5 h-3.5" />
                        Issue to Confluence
                      </>
                    )}
                  </button>
                </div>
                {confluencePageUrl && (
                  <a
                    href={confluencePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="design-mono flex items-center gap-2"
                    style={{
                      fontSize: "0.7rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "hsl(var(--design-mark))",
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View page in Confluence
                  </a>
                )}
              </div>

            </div>
          )}

        </div>
        </Panel>
      </PanelGroup>
      )}
    </div>
  );
};

// Small helper used by the document view's collapsed brief — keeps the
// collapsed-plate styling DRY across details/summary instances.
const CollapsedPlate = ({
  plateNum,
  label,
  children,
}: {
  plateNum: string;
  label: string;
  children: React.ReactNode;
}) => (
  <details
    className="group overflow-hidden border-l-2"
    style={{
      borderColor: "hsl(var(--design-emerald))",
      background: "hsl(var(--design-paper-deep))",
    }}
  >
    <summary
      className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none"
      style={{ background: "hsl(var(--design-paper-deep))" }}
    >
      <span
        className="design-mono"
        style={{
          fontSize: "0.66rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "hsl(var(--design-emerald))",
        }}
      >
        {plateNum}
      </span>
      <span className="design-eyebrow flex-1">{label}</span>
      <ChevronDown
        className="w-4 h-4 transition-transform group-open:rotate-180 flex-shrink-0"
        style={{ color: "hsl(var(--design-ink-muted))" }}
      />
    </summary>
    <div
      className="px-4 pb-4 pt-2 border-t"
      style={{ borderColor: "hsl(var(--design-rule) / 0.55)" }}
    >
      {children}
    </div>
  </details>
);

// Diagram-type picker — three editorial plates, one per architectural view.
// Mirrors the LucidDashboard variant so the two authoring tabs feel symmetric;
// kept inline (not extracted to a shared component) because the cards have
// slightly different copy that's tuned to the draw.io flow.
const DRAWIO_TYPES: ReadonlyArray<{
  key: DesignDiagramType;
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
    marginalia: "Vendor-agnostic capabilities and the data flowing between them.",
    audience: "Devs · Architects · Business",
    Icon: Layers,
  },
  {
    key: "infrastructure",
    plate: "I · 02",
    title: "Infrastructure",
    subtitle: "Where & How",
    marginalia: "AWS services, networks, and how the deployed pieces wire up.",
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

const DiagramTypePicker = ({
  active,
  onPick,
  disabled,
}: {
  active: DesignDiagramType;
  onPick: (t: DesignDiagramType) => void;
  disabled?: boolean;
}) => (
  <div className="design-plate p-4">
    <div className="flex items-baseline justify-between mb-3">
      <div className="design-eyebrow">Specification · Diagram type</div>
      <span className="design-marginalia" style={{ fontSize: "0.74rem" }}>
        Three views, one drafting board.
      </span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {DRAWIO_TYPES.map((t) => {
        const isActive = active === t.key;
        const Icon = t.Icon;
        return (
          <button
            key={t.key}
            type="button"
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
