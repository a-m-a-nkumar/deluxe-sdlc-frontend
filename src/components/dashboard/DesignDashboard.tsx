import { useState, useEffect } from "react";
import pako from "pako";
import { RefreshCw, FileText, CheckSquare, Square, Wand2, Code2, Download, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState } from "@/contexts/AppStateContext";
import { fetchConfluencePages, fetchConfluencePageDetails, ConfluencePage } from "@/services/confluenceApi";
import { generateArchitecturePrompt, generateDrawioXML } from "@/services/designApi";

function encodeXmlForDrawioViewer(xml: string): string {
  const data = new TextEncoder().encode(xml);
  const compressed = pako.deflateRaw(data);
  let binary = "";
  compressed.forEach((byte) => (binary += String.fromCharCode(byte)));
  return encodeURIComponent(btoa(binary));
}

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

  // Card collapse state
  const [showPromptCard, setShowPromptCard] = useState(true);
  const [showXMLCard, setShowXMLCard] = useState(true);

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

  const togglePage = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
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
      const prompt = await generateArchitecturePrompt(pageContents);
      setGeneratedPrompt(prompt);
      setGeneratedXML("");
      toast({ title: "Prompt generated", description: "Enhanced architecture prompt is ready. You can edit it before generating XML." });
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

  return (
    <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 md:p-6 lg:p-8" style={{ backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="mb-4 lg:mb-6">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1">Design Assistant</h1>
        <p className="text-muted-foreground text-sm">Generate architecture diagrams from Confluence documentation</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* ── Left Panel: Confluence Page Selector ── */}
        <div className="xl:col-span-2">
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-bold">Select Confluence Pages</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose pages to collect context for diagram generation
                  </p>
                </div>
                {/* Refresh button — only shown when a space is configured */}
                {confluenceSpaceKey && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadPages(confluenceSpaceKey)}
                    disabled={isLoadingPages}
                    className="flex-shrink-0 px-3 mt-0.5"
                    title="Reload pages"
                  >
                    {isLoadingPages ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Project space badge */}
              {confluenceSpaceKey ? (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs text-muted-foreground">Space:</span>
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {confluenceSpaceKey}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — {selectedProject?.project_name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {selectedProject
                    ? `No Confluence space configured for "${selectedProject.project_name}"`
                    : "No project selected. Select a project to load its Confluence pages."}
                </div>
              )}

              {/* Search filter — only shown once pages are loaded */}
              {pages.length > 0 && (
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="mt-2 h-8 text-sm"
                />
              )}
            </CardHeader>

            <CardContent className="flex-1 flex flex-col min-h-0">
              {pages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm px-4 py-8">
                  {!selectedProject
                    ? "Select a project from the header to load its linked Confluence pages."
                    : !confluenceSpaceKey
                    ? "This project has no Confluence space configured. Edit the project settings to add one."
                    : isLoadingPages
                    ? "Loading pages..."
                    : "No pages found in this space."}
                </div>
              ) : (
                <>
                  {/* Select-all toggle + count */}
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <button
                      onClick={toggleAll}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {selectedPageIds.size === filteredPages.length && filteredPages.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      {selectedPageIds.size === filteredPages.length && filteredPages.length > 0
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                    <span>
                      {selectedPageIds.size} of {filteredPages.length} selected
                    </span>
                  </div>

                  {/* Page list */}
                  <div className="flex-1 overflow-y-auto space-y-1 max-h-64 xl:max-h-96 pr-1">
                    {filteredPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => togglePage(page.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors hover:bg-muted/50 ${
                          selectedPageIds.has(page.id)
                            ? "bg-blue-50 border border-blue-200"
                            : "border border-transparent"
                        }`}
                      >
                        {selectedPageIds.has(page.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Generate Prompt button */}
              <div className="mt-4">
                <Button
                  className="w-full"
                  onClick={handleGeneratePrompt}
                  disabled={selectedPageIds.size === 0 || isGeneratingPrompt}
                >
                  {isGeneratingPrompt ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2 flex-shrink-0" />
                      Collecting context &amp; generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Architecture Prompt
                    </>
                  )}
                </Button>
                {selectedPageIds.size > 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Panel: Prompt + XML ── */}
        <div className="xl:col-span-3 flex flex-col gap-4 min-h-0">
          {/* Enhanced Prompt Card */}
          <Card className={showPromptCard ? "flex-1 flex flex-col min-h-0" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Enhanced Architecture Prompt</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Lucid Chart
                  </span>
                  <button
                    onClick={() => setShowPromptCard((v) => !v)}
                    className="p-0.5 rounded hover:bg-muted/60 transition-colors"
                    title={showPromptCard ? "Collapse" : "Expand"}
                  >
                    {showPromptCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {showPromptCard && (
                <p className="text-xs text-muted-foreground">
                  Edit the prompt before using it in Lucid Chart or generating a draw.io XML file
                </p>
              )}
            </CardHeader>
            {showPromptCard && (
              <CardContent className="flex-1 flex flex-col min-h-0">
                <Textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  placeholder="Select Confluence pages on the left and click 'Generate Architecture Prompt' to create an AI-enhanced prompt for your architecture diagram..."
                  className="flex-1 min-h-0 text-sm font-mono resize-none"
                />
              </CardContent>
            )}
          </Card>

          {/* draw.io XML Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">draw.io XML Export</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    draw.io
                  </span>
                  <button
                    onClick={() => setShowXMLCard((v) => !v)}
                    className="p-0.5 rounded hover:bg-muted/60 transition-colors"
                    title={showXMLCard ? "Collapse" : "Expand"}
                  >
                    {showXMLCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {showXMLCard && (
                <p className="text-xs text-muted-foreground">
                  Generate an importable XML diagram file from your finalised prompt
                </p>
              )}
            </CardHeader>
            {showXMLCard && (
              <CardContent className="space-y-3">
                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-[#8C8C8C] bg-white hover:bg-gray-50"
                    onClick={handleGenerateXML}
                    disabled={!generatedPrompt.trim() || isGeneratingXML}
                  >
                    {isGeneratingXML ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2 flex-shrink-0" />
                        Generating XML...
                      </>
                    ) : (
                      <>
                        <Code2 className="w-4 h-4 mr-2" />
                        Generate draw.io XML
                      </>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleDownloadXML}
                    disabled={!generatedXML}
                    className="flex-shrink-0"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download XML
                  </Button>
                </div>

                {/* Diagram Preview */}
                {generatedXML && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <iframe
                      src={`https://viewer.diagrams.net/?lightbox=0&highlight=0000ff&edit=_blank&layers=1&nav=1#R${encodeXmlForDrawioViewer(generatedXML)}`}
                      className="w-full border-0"
                      style={{ height: "480px" }}
                      title="Architecture Diagram Preview"
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
