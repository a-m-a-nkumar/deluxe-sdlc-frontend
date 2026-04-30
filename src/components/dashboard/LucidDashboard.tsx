import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw, FileText, CheckSquare, Square, Wand2, AlertCircle, ExternalLink, LayoutDashboard, Link2, CheckCircle2, Layers, Server, Shield, Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState } from "@/contexts/AppStateContext";
import { fetchConfluencePages, fetchConfluencePageDetails, ConfluencePage } from "@/services/confluenceApi";
import { generateLucidPromptStream, createLucidViaMcp, getLucidAuthUrl, getLucidStatus } from "@/services/lucidApi";
import { cn } from "@/lib/utils";

export const LucidDashboard = () => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { selectedProject } = useAppState();
  const location = useLocation();

  const confluenceSpaceKey = selectedProject?.confluence_space_key ?? null;

  // Step 1 — Confluence page selection
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 — Architecture description prompt
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Step 3 — Lucidchart creation
  const [diagramTitle, setDiagramTitle] = useState("");
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [diagramUrl, setDiagramUrl] = useState("");

  // Lucid OAuth connection state
  const [isLucidConnected, setIsLucidConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Diagram type selection
  const [diagramType, setDiagramType] = useState<"logical" | "infrastructure" | "security">("infrastructure");

  // Copy prompt state
  const [copied, setCopied] = useState(false);

  // Expand/minimize prompt
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const step1Done = selectedPageIds.size > 0;
  const step2Done = generatedPrompt.trim().length > 0 && !isGeneratingPrompt;
  const isProcessing = isGeneratingPrompt || isCreatingDiagram;

  const loadPages = async (spaceKey: string) => {
    if (!accessToken) return;
    setIsLoadingPages(true);
    setPages([]);
    setSelectedPageIds(new Set());
    try {
      const result = await fetchConfluencePages(accessToken, spaceKey);
      setPages(result);
      if (result.length === 0) {
        toast({ title: "No pages found", description: `No pages found in space "${spaceKey}".` });
      }
    } catch (error: any) {
      toast({ title: "Failed to load pages", description: error.message, variant: "destructive" });
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

  // Reset state when project changes
  useEffect(() => {
    setGeneratedPrompt("");
    setDiagramUrl("");
    setSelectedPageIds(new Set());
  }, [selectedProject?.id]);

  // Reset prompt when diagram type changes
  useEffect(() => {
    setGeneratedPrompt("");
    setDiagramUrl("");
  }, [diagramType]);

  // Check Lucid connection status on mount
  useEffect(() => {
    getLucidStatus().then(setIsLucidConnected).catch(() => setIsLucidConnected(false));
  }, []);

  // Handle OAuth callback redirect (?lucid=connected or ?lucid=error)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lucid = params.get("lucid");
    if (lucid === "connected") {
      setIsLucidConnected(true);
      toast({ title: "Lucid connected!", description: "You can now create diagrams via Lucid AI." });
      window.history.replaceState({}, "", location.pathname);
    } else if (lucid === "error") {
      toast({ title: "Lucid connection failed", description: "Could not connect to Lucid. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location.search]);

  const handleConnectLucid = async () => {
    setIsConnecting(true);
    try {
      const url = await getLucidAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      toast({ title: "Failed to connect", description: error.message, variant: "destructive" });
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
    if (selectedPageIds.size === filteredPages.length && filteredPages.length > 0) {
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
              .trim()
          )
        )
      );
      await generateLucidPromptStream(
        { project_id: selectedProject.id, page_contents: pageContents, diagram_type: diagramType },
        (text) => setGeneratedPrompt((prev) => prev + text),
      );
    } catch (error: any) {
      toast({ title: "Failed to generate prompt", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCreateDiagram = async () => {
    if (!generatedPrompt.trim()) return;
    setIsCreatingDiagram(true);
    setDiagramUrl("");
    try {
      const title = diagramTitle.trim() || `${selectedProject?.project_name ?? "Architecture"} Diagram`;
      const result = await createLucidViaMcp({ prompt: generatedPrompt, title });
      setDiagramUrl(result.edit_url);
      toast({ title: "Diagram created!", description: "Lucid AI built your architecture diagram." });
    } catch (error: any) {
      toast({ title: "Failed to create diagram", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingDiagram(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F7F9FC]">

      {/* ── Page Header ── */}
      <div className="px-6 sm:px-8 py-4 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Lucidchart Diagrams</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">Generate architecture diagrams in Lucidchart from Confluence pages</p>
        </div>
      </div>

      {/* ── Step Indicator ── */}
      <div className="px-6 sm:px-8 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1 max-w-lg">
          {[
            { n: 1, label: "Select Pages",  done: step1Done },
            { n: 2, label: "Review Prompt", done: step2Done },
            { n: 3, label: "Create Diagram", done: !!diagramUrl },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                  s.done ? "bg-green-600 text-white" : i === arr.findIndex(x => !x.done) ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
                )}>
                  {s.done ? "✓" : s.n}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:block whitespace-nowrap",
                  s.done ? "text-green-600" : i === arr.findIndex(x => !x.done) ? "text-primary" : "text-gray-400"
                )}>
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className={cn("flex-1 h-px mx-1", s.done ? "bg-green-300" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 min-h-0 flex flex-row gap-0 overflow-hidden">

        {/* ══ LEFT PANEL: Page Selector (Step 1) ══ */}
        <div className="w-[300px] border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden flex-shrink-0 px-5 py-4">

          {/* Panel header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                step1Done ? "bg-green-600" : "bg-primary"
              )}>
                1
              </div>
              <span className="text-sm font-semibold text-[#1a1a1a]">Select Pages</span>
            </div>
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
          </div>

          {/* Space badge */}
          {confluenceSpaceKey ? (
            <div className="flex items-center gap-1.5 mb-3 flex-shrink-0">
              <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {confluenceSpaceKey}
              </span>
              <span className="text-xs text-gray-400">— {selectedProject?.project_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-600 flex-shrink-0">
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
              className="h-8 text-sm mb-3 flex-shrink-0"
            />
          )}

          {/* Page list */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                {/* Select all bar */}
                <div className="flex items-center justify-between mb-2 text-xs text-gray-400 flex-shrink-0">
                  <button
                    onClick={toggleAll}
                    disabled={isProcessing}
                    className={`flex items-center gap-1 transition-colors ${isProcessing ? "opacity-40 cursor-not-allowed" : "hover:text-gray-600"}`}
                  >
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0
                      ? <CheckSquare className="w-3.5 h-3.5" />
                      : <Square className="w-3.5 h-3.5" />}
                    {selectedPageIds.size === filteredPages.length && filteredPages.length > 0 ? "Deselect all" : "Select all"}
                  </button>
                  <span>{selectedPageIds.size} of {filteredPages.length} selected</span>
                </div>

                {/* Scrollable list */}
                <div className="relative flex-1 min-h-0 flex flex-col">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 rounded-lg bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 border border-gray-200">
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      <span className="text-xs text-gray-500 font-medium text-center px-3">
                        {isGeneratingPrompt ? "Generating prompt…" : "Creating diagram…"}
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
              disabled={selectedPageIds.size === 0 || isGeneratingPrompt || !confluenceSpaceKey}
            >
              {isGeneratingPrompt ? (
                <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Generating prompt...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" />Generate Prompt</>
              )}
            </Button>
            {selectedPageIds.size > 0 && !isGeneratingPrompt && (
              <p className="text-xs text-gray-400 text-center mt-1.5">
                {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL: Steps 2 & 3 ══ */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5">

          {/* ── Diagram Type Selector ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Choose Diagram Type</p>
            <div className="grid grid-cols-3 gap-3">

              {/* Logical */}
              <button
                onClick={() => setDiagramType("logical")}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
                  diagramType === "logical"
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                )}
              >
                {diagramType === "logical" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                )}
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  diagramType === "logical" ? "bg-blue-100" : "bg-gray-100"
                )}>
                  <Layers className={cn("w-5 h-5", diagramType === "logical" ? "text-blue-600" : "text-gray-500")} />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", diagramType === "logical" ? "text-blue-700" : "text-gray-700")}>Logical</p>
                  <p className="text-xs text-gray-400 mt-0.5">What & Why?</p>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">Vendor-agnostic view of what the system does and how data flows</p>
                  <span className="inline-block mt-2 text-[10px] font-medium bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Devs · Architects · Business</span>
                </div>
              </button>

              {/* Infrastructure */}
              <button
                onClick={() => setDiagramType("infrastructure")}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
                  diagramType === "infrastructure"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                )}
              >
                {diagramType === "infrastructure" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                )}
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  diagramType === "infrastructure" ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Server className={cn("w-5 h-5", diagramType === "infrastructure" ? "text-emerald-600" : "text-gray-500")} />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", diagramType === "infrastructure" ? "text-emerald-700" : "text-gray-700")}>Infrastructure</p>
                  <p className="text-xs text-gray-400 mt-0.5">Where & How?</p>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">Deployment-level view of where the system runs and how resources connect</p>
                  <span className="inline-block mt-2 text-[10px] font-medium bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">DevOps · SRE · Platform</span>
                </div>
              </button>

              {/* Security */}
              <button
                onClick={() => setDiagramType("security")}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
                  diagramType === "security"
                    ? "border-rose-500 bg-rose-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
                )}
              >
                {diagramType === "security" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />
                )}
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  diagramType === "security" ? "bg-rose-100" : "bg-gray-100"
                )}>
                  <Shield className={cn("w-5 h-5", diagramType === "security" ? "text-rose-600" : "text-gray-500")} />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", diagramType === "security" ? "text-rose-700" : "text-gray-700")}>Security</p>
                  <p className="text-xs text-gray-400 mt-0.5">Who & Protected?</p>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">Trust boundaries, security controls, and access policies</p>
                  <span className="inline-block mt-2 text-[10px] font-medium bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Security · Auditors · Compliance</span>
                </div>
              </button>

            </div>
          </div>

        {/* ── Step 2: Architecture Prompt ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                  step2Done ? "bg-green-600" : "bg-primary"
                )}>
                  2
                </div>
                <span className="text-sm font-semibold text-[#1a1a1a]">
                  Review {diagramType === "logical" ? "Logical" : diagramType === "security" ? "Security" : "Infrastructure"} Description
                </span>
              </div>
              {generatedPrompt && !isGeneratingPrompt && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleCopyPrompt}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all",
                      copied
                        ? "bg-green-50 border-green-200 text-green-600"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    )}
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </button>
                  <button
                    onClick={() => setIsPromptExpanded(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
                  >
                    {isPromptExpanded
                      ? <><Minimize2 className="w-3.5 h-3.5" />Minimize</>
                      : <><Maximize2 className="w-3.5 h-3.5" />Expand</>}
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Claude reads your Confluence pages and generates a {diagramType === "logical" ? "logical architecture" : diagramType === "security" ? "security architecture" : "infrastructure"} description. Review and edit it before creating the diagram.
            </p>

            {!generatedPrompt && !isGeneratingPrompt ? (
              <div className="flex flex-col items-center justify-center text-center text-gray-400 text-sm py-10 gap-2 ml-8">
                <Wand2 className="w-8 h-8 text-gray-200" />
                <span>Select pages and click "Generate Prompt" to get started</span>
              </div>
            ) : (
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder={isGeneratingPrompt ? "Generating architecture description…" : ""}
                className={cn(
                  "text-sm font-mono resize-none ml-8 transition-all duration-300",
                  isPromptExpanded ? "min-h-[600px]" : "min-h-[260px]"
                )}
                disabled={isGeneratingPrompt}
              />
            )}
          </div>

          {/* ── Step 3: Create via Lucid AI ── */}
          <div className={cn(
            "bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 transition-opacity",
            !step2Done ? "opacity-50 pointer-events-none" : ""
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                  diagramUrl ? "bg-green-600" : "bg-primary"
                )}>
                  3
                </div>
                <span className="text-sm font-semibold text-[#1a1a1a]">Create via Lucid AI</span>
              </div>

              {/* Lucid connection badge / button */}
              {isLucidConnected ? (
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-2.5 py-1 rounded-full flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected to Lucid
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 flex-shrink-0"
                  onClick={handleConnectLucid}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <><div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />Connecting...</>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5 mr-1.5" />Connect to Lucid</>
                  )}
                </Button>
              )}
            </div>

            {!isLucidConnected && (
              <p className="text-xs text-amber-600 ml-8 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Connect your Lucid account to create diagrams.
              </p>
            )}

            <div className="ml-8 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium whitespace-nowrap w-24">Diagram title:</label>
                <Input
                  value={diagramTitle}
                  onChange={(e) => setDiagramTitle(e.target.value)}
                  placeholder={`${selectedProject?.project_name ?? "Architecture"} Diagram`}
                  className="h-8 text-sm flex-1"
                />
              </div>

              <Button
                className="font-medium bg-primary text-white w-full"
                onClick={handleCreateDiagram}
                disabled={!generatedPrompt.trim() || isCreatingDiagram || !isLucidConnected}
              >
                {isCreatingDiagram ? (
                  <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Creating diagram...</>
                ) : (
                  <><LayoutDashboard className="w-4 h-4 mr-2" />Create via Lucid AI</>
                )}
              </Button>

              {diagramUrl && (
                <a
                  href={diagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink className="w-4 h-4" />Open Diagram in Lucidchart
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
