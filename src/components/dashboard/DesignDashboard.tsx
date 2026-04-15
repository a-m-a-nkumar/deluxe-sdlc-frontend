import { useState, useEffect, useRef } from "react";
import { RefreshCw, FileText, CheckSquare, Square, Wand2, Code2, Download, ChevronDown, AlertCircle, Maximize2, Minimize2, BookText, ExternalLink, Pencil, PlusCircle, Clock } from "lucide-react";
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

export const DesignDashboard = () => {
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

  // Step 3 — draw.io XML
  const [generatedXML, setGeneratedXML] = useState("");
  const [isGeneratingXML, setIsGeneratingXML] = useState(false);

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

  // Left panel collapse (create mode)
  const [leftCollapsed, setLeftCollapsed] = useState(false);

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
    setGeneratedXML("");
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
  }, [selectedProject?.id]);

  // Auto-check for a saved diagram when project changes
  useEffect(() => {
    setSavedDiagramBanner(null);
    setDiagramPageUrl("");
    if (!confluenceSpaceKey || !selectedProject) return;
    loadDiagramFromConfluence(selectedProject.id, confluenceSpaceKey)
      .then((result) => {
        if (result) setSavedDiagramBanner({ xml: result.xml, page_url: result.page_url });
      })
      .catch(() => {}); // silent — no saved diagram is fine
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
      await generateArchitecturePromptStream(pageContents, (text) => {
        setGeneratedPrompt(prev => prev + text);
      });
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

  return (
    <div className="flex flex-col overflow-hidden h-[calc(100vh-4rem)] bg-[#F7F9FC]">

      {/* ── Page Header ── */}
      <div className="px-6 sm:px-8 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Design Assistant</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">Generate architecture diagrams and documents from Confluence pages</p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={handleEnterCreateMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "create" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />Create New
          </button>
          <button
            onClick={handleEnterEditMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "edit" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />Edit Diagrams
          </button>
        </div>
      </div>

      {/* ── Step Indicator ── */}
      <div className="px-6 sm:px-8 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1 max-w-2xl">
          {[
            { n: 1, label: "Select Pages", done: step1Done },
            { n: 2, label: "Review Prompt", done: step2Done },
            { n: 3, label: "Generate Diagram", done: step3Done },
            { n: 4, label: "Create Document", done: step4Done },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                    s.done ? "bg-green-600 text-white" : i === arr.findIndex(x => !x.done) ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
                  )}
                >
                  {s.done ? <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" /> : s.n}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block whitespace-nowrap",
                    s.done ? "text-green-600" : i === arr.findIndex(x => !x.done) ? "text-primary" : "text-gray-400"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 rounded-full", s.done ? "bg-green-600" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ══ EDIT MODE ══ */}
      {viewMode === "edit" && (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-5 gap-0 overflow-hidden">

          {/* Left — saved diagram list */}
          <div className="xl:col-span-2 border-r border-gray-200 bg-white flex flex-col p-5 h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary">
                  <Pencil className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1a1a1a]">Saved Diagrams</span>
              </div>
              <button
                onClick={loadEditDiagrams}
                disabled={isLoadingEditDiagrams}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="Refresh list"
              >
                {isLoadingEditDiagrams
                  ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>

            {/* Space badge */}
            {confluenceSpaceKey && (
              <div className="flex items-center gap-1.5 mb-3 flex-shrink-0">
                <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{confluenceSpaceKey}</span>
                <span className="text-xs text-gray-400">— {selectedProject?.project_name}</span>
              </div>
            )}

            {/* Search */}
            {editDiagrams.length > 0 && (
              <Input
                value={editSearchQuery}
                onChange={(e) => setEditSearchQuery(e.target.value)}
                placeholder="Search diagrams..."
                className="h-8 text-sm mb-3 flex-shrink-0"
              />
            )}

            {/* Diagram list */}
            <div className="overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-1.5 space-y-1 max-h-[calc(100vh-300px)]">
              {isLoadingEditDiagrams ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading diagrams...
                </div>
              ) : editDiagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-gray-400 text-sm py-12 gap-2">
                  <FileText className="w-8 h-8 text-gray-200" />
                  <span>No saved diagrams found in this space</span>
                  <span className="text-xs text-gray-300">Save a diagram from Create mode first</span>
                </div>
              ) : (
                editDiagrams
                  .filter(d => d.title.toLowerCase().includes(editSearchQuery.toLowerCase()))
                  .map((diagram) => (
                    <button
                      key={diagram.page_id}
                      onClick={() => !isLoadingEditXML && handleSelectEditDiagram(diagram)}
                      disabled={isLoadingEditXML}
                      className={`w-full flex items-start gap-2 p-2.5 rounded-lg text-left text-sm transition-colors ${
                        editingPageTitle === diagram.title
                          ? "bg-blue-50 border border-blue-200"
                          : "bg-white border border-transparent hover:bg-gray-50"
                      } ${isLoadingEditXML ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-gray-700 font-medium">{diagram.title}</p>
                        {diagram.last_modified && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(diagram.last_modified).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Right — diagram editor (adaptive) */}
          <div className="xl:col-span-3 flex flex-col overflow-y-auto">

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
                  <Button
                    size="sm" className="text-xs gap-1.5 text-white bg-violet-500"
                    onClick={handleGenerateDocument} disabled={isGeneratingDocument}
                  >
                    {isGeneratingDocument
                      ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating...</>
                      : <><BookText className="w-3.5 h-3.5" />Generate Document</>}
                  </Button>
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
        </div>
      )}

      {/* ── Main Content (Create mode) ── */}
      {viewMode === "create" && (
      <div className="flex-1 min-h-0 flex flex-row gap-0 overflow-hidden">

        {/* ══ LEFT PANEL: Page Selector (Step 1) ══ */}
        <div
          className={cn(
            "border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden transition-all duration-200 flex-shrink-0",
            leftCollapsed ? "w-10" : "w-[340px] px-[1.6rem] py-4"
          )}
        >
          {/* Collapsed strip — just shows expand button */}
          {leftCollapsed && (
            <div className="flex flex-col items-center pt-4 gap-3 h-full">
              <button
                onClick={() => setLeftCollapsed(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="Expand panel"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
              {step1Done && (
                <span className="text-[10px] font-bold text-green-600 rotate-90 whitespace-nowrap mt-2">
                  {selectedPageIds.size} selected
                </span>
              )}
            </div>
          )}

          {/* Expanded content */}
          {!leftCollapsed && <>

          {/* Panel header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", step1Done ? "bg-green-600" : "bg-primary")}>
                1
              </div>
              <span className="text-sm font-semibold text-[#1a1a1a]">Select Confluence Pages</span>
            </div>
            <div className="flex items-center gap-1">
              {confluenceSpaceKey && (
                <button
                  onClick={() => loadPages(confluenceSpaceKey)}
                  disabled={isLoadingPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                  title="Reload pages"
                >
                  {isLoadingPages
                    ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    : <RefreshCw className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => setLeftCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="Collapse panel"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
            </div>
          </div>

          {/* Space badge */}
          {confluenceSpaceKey ? (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {confluenceSpaceKey}
              </span>
              <span className="text-xs text-gray-400">— {selectedProject?.project_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{selectedProject ? `No Confluence space for "${selectedProject.project_name}"` : "Select a project first"}</span>
            </div>
          )}

          {/* Search */}
          {pages.length > 0 && (
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages..."
              className="h-8 text-sm mb-3"
            />
          )}

          {/* Page list */}
          <div className="flex-1 min-h-0 flex flex-col">
            {pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-gray-400 text-sm py-12 gap-2">
                <FileText className="w-8 h-8 text-gray-200" />
                <span>
                  {!selectedProject ? "Select a project to load pages"
                    : !confluenceSpaceKey ? "No Confluence space configured"
                    : isLoadingPages ? "Loading pages..."
                    : "No pages found"}
                </span>
              </div>
            ) : (
              <>
                {/* Select all bar — pinned, never scrolls */}
                <div className="flex items-center justify-between mb-2 text-xs text-gray-400 flex-shrink-0">
                  <button onClick={toggleAll} disabled={isProcessing} className={`flex items-center gap-1 transition-colors ${isProcessing ? "opacity-40 cursor-not-allowed" : "hover:text-gray-600"}`}>
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0
                      ? <CheckSquare className="w-3.5 h-3.5" />
                      : <Square className="w-3.5 h-3.5" />}
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0 ? "Deselect all" : "Select all"}
                  </button>
                  <span>{selectedPageIds.size} of {filteredPages.length} selected</span>
                </div>

                {/* Scrollable page list */}
                <div className="relative flex-1 min-h-0 flex flex-col">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 rounded-lg bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 border border-gray-200">
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      <span className="text-xs text-gray-500 font-medium text-center px-3">
                        {isGeneratingPrompt ? "Generating prompt…" : isGeneratingXML ? "Generating diagram…" : isGeneratingDocument ? "Generating document…" : isSavingDiagram ? "Saving diagram…" : "Pushing to Confluence…"}
                        <br />
                        <span className="text-gray-400">Page selection locked</span>
                      </span>
                    </div>
                  )}
                  <div className={`flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-1.5 space-y-1 ${isProcessing ? "pointer-events-none select-none opacity-50" : ""}`}>
                    {filteredPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => togglePage(page.id)}
                        disabled={isProcessing}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                          selectedPageIds.has(page.id)
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-white border border-transparent hover:bg-gray-50"
                        } ${isProcessing ? "cursor-not-allowed" : ""}`}
                      >
                        {selectedPageIds.has(page.id)
                          ? <CheckSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate text-gray-700">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Generate Prompt CTA */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex-shrink-0">
            <Button
              className="w-full font-medium bg-primary text-white"
              onClick={handleGeneratePrompt}
              disabled={selectedPageIds.size === 0 || isGeneratingPrompt}
            >
              {isGeneratingPrompt ? (
                <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Generating prompt...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" />Generate Architecture Prompt</>
              )}
            </Button>
            {selectedPageIds.size > 0 && !isGeneratingPrompt && (
              <p className="text-xs text-gray-400 text-center mt-1.5">
                {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
          </>}
        </div>

        {/* ══ RIGHT PANEL: adaptive per step ══ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

          {/* ── Saved diagram banner ── */}
          {savedDiagramBanner && !step3Done && (
            <div className="mx-5 mt-5 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Download className="w-4 h-4 flex-shrink-0" />
                <span>A saved diagram was found for this project.</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={savedDiagramBanner.page_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />View
                </a>
                <Button
                  size="sm"
                  className="text-xs text-white h-7 px-3 bg-primary"
                  disabled={isLoadingDiagram}
                  onClick={() => {
                    setGeneratedXML(savedDiagramBanner.xml);
                    setDiagramPageUrl(savedDiagramBanner.page_url);
                    setSavedDiagramBanner(null);
                    toast({ title: "Diagram loaded", description: "Your saved diagram has been loaded into the editor." });
                  }}
                >
                  Load Diagram
                </Button>
                <button onClick={() => setSavedDiagramBanner(null)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">&times;</button>
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!step2Done && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-24 px-8 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 bg-primary/[6%]">
                <Wand2 className="w-7 h-7 text-primary" />
              </div>
              <p className="text-base font-medium text-gray-600">Select pages and generate a prompt</p>
              <p className="text-sm text-gray-400 max-w-xs">Choose one or more Confluence pages on the left, then click <span className="font-medium text-gray-500">Generate Architecture Prompt</span> to begin.</p>
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary">2</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1a1a]">Architecture Prompt</p>
                    <p className="text-xs text-gray-400">{isGeneratingPrompt ? "AI is writing…" : "Edit directly below, then generate the diagram"}</p>
                  </div>
                  {isGeneratingPrompt && (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent flex-shrink-0" />
                  )}
                </div>

                {/* Compact stats bar — shown once prompt is ready */}
                {(nameMatch || componentLines.length > 0) && (
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {nameMatch && (
                      <span className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full truncate max-w-[200px]">
                        {nameMatch[1].trim()}
                      </span>
                    )}
                    {componentLines.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {componentLines.length} components
                      </span>
                    )}
                    {connectionLines.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {connectionLines.length} connections
                      </span>
                    )}
                  </div>
                )}

                {/* Editable prompt textarea — fills remaining space */}
                <Textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="flex-1 text-xs font-mono resize-none leading-relaxed min-h-[300px]"
                  placeholder="Generating architecture prompt…"
                />

                {/* Action buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                    <Code2 className="w-3.5 h-3.5 mr-1.5" />Copy
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setGeneratedPrompt("")}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Clear
                  </Button>
                  <Button
                    className="flex-1 font-medium text-white text-sm bg-primary"
                    onClick={handleGenerateXML}
                    disabled={!generatedPrompt.trim() || isGeneratingXML || isGeneratingPrompt}
                  >
                    {isGeneratingXML
                      ? <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Generating...</>
                      : <><Code2 className="w-4 h-4 mr-2" />Generate Diagram</>}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ── DIAGRAM VIEW (step3Done) ── */}
          {step3Done && !step4Done && (
            <div className="flex flex-col h-full p-5 gap-4">
              {/* Collapsed prompt accordion */}
              <details className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-green-600">2</div>
                  <span className="text-sm font-medium text-gray-600 flex-1">Architecture Prompt</span>
                  <span className="text-xs text-gray-400 mr-2">click to view / edit</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <Textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    className="w-full text-sm font-mono resize-none min-h-[160px]"
                  />
                  <Button
                    className="mt-2 w-full font-medium text-white bg-primary"
                    size="sm"
                    onClick={handleGenerateXML}
                    disabled={!generatedPrompt.trim() || isGeneratingXML || isGeneratingDocument || isGeneratingPrompt}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />Regenerate Diagram
                  </Button>
                </div>
              </details>

              {/* Diagram header */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-green-600">3</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1a1a1a]">Architecture Diagram</p>
                  <p className="text-xs text-gray-400">Edit directly in the embedded draw.io editor</p>
                </div>
              </div>

              {/* Diagram iframe — fills remaining space */}
              <div
                className={cn(
                  isFullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : "flex-1 border border-gray-200 rounded-xl overflow-hidden",
                  !isFullscreen && "min-h-[420px]"
                )}
              >
                {isFullscreen && (
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
                    <span className="text-sm font-semibold">Architecture Diagram Editor</span>
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

              {/* Confluence title input */}
              <div className="flex items-center gap-2 px-1">
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <Input
                  value={diagramSaveTitle}
                  onChange={(e) => setDiagramSaveTitle(e.target.value)}
                  placeholder="Diagram title in Confluence…"
                  className="h-7 text-xs flex-1"
                />
              </div>

              {/* Buttons below diagram */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="text-xs gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />Full Screen
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadXML} className="text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" />Download XML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleSaveDiagram}
                  disabled={isSavingDiagram || !confluenceSpaceKey}
                >
                  {isSavingDiagram
                    ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</>
                    : <><FileText className="w-3.5 h-3.5" />Save to Confluence</>}
                </Button>
                <Button
                  size="sm"
                  className="text-xs gap-1.5 text-white bg-violet-500"
                  onClick={handleGenerateDocument}
                  disabled={isGeneratingDocument || isGeneratingXML || isGeneratingPrompt}
                >
                  {isGeneratingDocument
                    ? <><div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent mr-1.5" />Generating...</>
                    : <><BookText className="w-3.5 h-3.5" />Generate Document</>}
                </Button>
              </div>

              {/* Saved link */}
              {diagramPageUrl && (
                <a href={diagramPageUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />View saved diagram in Confluence
                </a>
              )}
            </div>
          )}

          {/* ── DOCUMENT VIEW (step4Done) ── */}
          {step4Done && (
            <div className="flex flex-col h-full p-5 gap-4">

              {/* Collapsed prompt */}
              <details className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-green-600">2</div>
                  <span className="text-sm font-medium text-gray-600 flex-1">Architecture Prompt</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <Textarea value={generatedPrompt} onChange={(e) => setGeneratedPrompt(e.target.value)} className="w-full text-sm font-mono resize-none min-h-[120px]" />
                </div>
              </details>

              {/* Collapsed diagram */}
              <details className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-green-600">3</div>
                  <span className="text-sm font-medium text-gray-600 flex-1">Architecture Diagram</span>
                  <div className="flex items-center gap-2 mr-2">
                    <button onClick={(e) => { e.preventDefault(); setIsFullscreen(true); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" />Fullscreen
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
                        <span className="text-sm font-semibold">Architecture Diagram Editor</span>
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

              {/* Page title + export actions */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Confluence page title:</label>
                  <Input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} className="h-8 text-sm flex-1" placeholder="Architecture Document" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleDownloadDocument}>
                    <Download className="w-4 h-4 mr-2" />Download .md
                  </Button>
                  <Button
                    className="flex-1 text-white bg-primary"
                    onClick={handlePushToConfluence}
                    disabled={isPushingToConfluence || !confluenceSpaceKey}
                  >
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

            </div>
          )}

        </div>
      </div>
      )}
    </div>
  );
};

