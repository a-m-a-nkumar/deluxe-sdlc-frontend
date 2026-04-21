import { useState, useEffect } from "react";
import {
  Search, ChevronDown, ArrowUp, Copy, CheckCircle2,
  Loader2, PenTool, ExternalLink, ArrowLeft, RefreshCw,
  Folder, ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { integrationsApi } from "@/services/integrationsApi";
import { figmaApi, FigmaProject } from "@/services/figmaApi";
import { JiraIssue } from "@/services/jiraApi";

type ActiveView = "home" | "figma-items" | "generate-prompt";

// Mirrors DisplayIssue in JiraDashboard.tsx
interface DisplayIssue {
  id: string; title: string; type: string; priority: string;
  status: string; assignee: string; reporter: string; points: string;
  created: string; updated: string; description: string; sprint: string;
  labels: string[]; url: string; parentKey?: string; parentTitle?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFigmaDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
};

// ─── Main component ───────────────────────────────────────────────────────────

export const FigmaDesignDashboard = () => {
  const [activeView, setActiveView] = useState<ActiveView>("home");

  return (
    <div className="h-full bg-white">
      <div className="p-2 sm:p-4 md:p-6">
        {activeView === "home" && <HomeView onNavigate={setActiveView} />}
        {activeView === "figma-items" && <FigmaItemsView onBack={() => setActiveView("home")} />}
        {activeView === "generate-prompt" && <GeneratePromptView onBack={() => setActiveView("home")} />}
      </div>
    </div>
  );
};

// ─── View 1: Home — two clickable cards ───────────────────────────────────────

const FIGMA_ITEMS_TAGS = ["Projects", "Files", "Thumbnails", "Quick Access"];
const GENERATE_TAGS    = ["Jira Stories", "Confluence RAG", "Claude AI", "Design Brief"];

const HomeView = ({ onNavigate }: { onNavigate: (v: ActiveView) => void }) => (
  <div>
    {/* Header */}
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1B3C71 0%, #2E6BC4 100%)" }}>
          <PenTool className="w-[18px] h-[18px] text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Figma Design</h1>
      </div>
      <p className="text-sm ml-12" style={{ color: "#858585" }}>
        Connect to your Figma workspace or generate AI-powered design prompts from your Jira stories.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Card 1 — Figma Items */}
      <button
        onClick={() => onNavigate("figma-items")}
        className="text-left relative overflow-hidden rounded-2xl border border-[#E5E7EB] p-6 hover:border-[#1B3C71] hover:shadow-xl transition-all duration-200 group bg-white"
      >
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #1B3C71, #4F86C6)" }} />

        {/* Icon */}
        <div className="w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-5 mt-2 shadow-sm" style={{ background: "linear-gradient(135deg, #EEF2F9 0%, #D1DFFE 100%)" }}>
          <Folder className="w-6 h-6" style={{ color: "#1B3C71" }} />
        </div>

        {/* Text */}
        <h2 className="text-lg font-bold mb-2 tracking-tight" style={{ color: "#1A1A1A" }}>Figma Items</h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#6C6C6C" }}>
          Connect with your PAT token and Team ID to browse all projects
          and files directly from the Figma REST API.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FIGMA_ITEMS_TAGS.map(tag => (
            <span key={tag} className="text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: "#EEF2F9", color: "#1B3C71" }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-1.5 text-sm font-semibold group-hover:gap-3 transition-all duration-200" style={{ color: "#1B3C71" }}>
          Browse Files <ExternalLink className="w-4 h-4" />
        </div>
      </button>

      {/* Card 2 — Generate Prompt */}
      <button
        onClick={() => onNavigate("generate-prompt")}
        className="text-left relative overflow-hidden rounded-2xl border border-[#E5E7EB] p-6 hover:border-[#7C3AED] hover:shadow-xl transition-all duration-200 group bg-white"
      >
        {/* Top accent bar — purple gradient to match AI theme */}
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #7C3AED, #A855F7)" }} />

        {/* Icon */}
        <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-5 mt-2 shadow-sm" style={{ background: "linear-gradient(135deg, #F3EEFF 0%, #E4D0FF 100%)" }}>
          <PenTool className="w-6 h-6" style={{ color: "#7C3AED" }} />
        </div>

        {/* Text */}
        <h2 className="text-lg font-bold mb-2 tracking-tight" style={{ color: "#1A1A1A" }}>Generate Prompt</h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#6C6C6C" }}>
          Select a Jira story and let Claude AI generate a complete Figma design
          brief enriched with your Confluence documentation.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {GENERATE_TAGS.map(tag => (
            <span key={tag} className="text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: "#F5F0FF", color: "#7C3AED" }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-1.5 text-sm font-semibold group-hover:gap-3 transition-all duration-200" style={{ color: "#7C3AED" }}>
          Generate Now <ArrowLeft className="w-4 h-4 rotate-180" />
        </div>
      </button>

    </div>
  </div>
);

// ─── View 2: Figma Items ───────────────────────────────────────────────────────

const FIGMA_CACHE_KEY = "figma_items_cache";
const FIGMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const readCache = (): FigmaProject[] | null => {
  try {
    const raw = localStorage.getItem(FIGMA_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > FIGMA_CACHE_TTL) { localStorage.removeItem(FIGMA_CACHE_KEY); return null; }
    return data as FigmaProject[];
  } catch { return null; }
};

const writeCache = (projects: FigmaProject[]) => {
  try { localStorage.setItem(FIGMA_CACHE_KEY, JSON.stringify({ data: projects, ts: Date.now() })); } catch { /* storage full */ }
};

const clearCache = () => { try { localStorage.removeItem(FIGMA_CACHE_KEY); } catch { /* ignore */ } };

const FigmaItemsView = ({ onBack }: { onBack: () => void }) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [pat, setPat] = useState("");
  const [teamId, setTeamId] = useState("");
  const [figmaLinked, setFigmaLinked] = useState(false);
  const [figmaProjects, setFigmaProjects] = useState<FigmaProject[]>([]);
  const [fetchingItems, setFetchingItems] = useState(false);
  const [linkingFigma, setLinkingFigma] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [fromCache, setFromCache] = useState(false);

  // On mount: show cache instantly, then check status + refresh in background
  useEffect(() => {
    const cached = readCache();
    if (cached && cached.length > 0) {
      setFigmaProjects(cached);
      setFigmaLinked(true);
      setFromCache(true);
      setExpandedProjects(new Set([cached[0].id]));
    }

    const checkStatus = async () => {
      if (!accessToken) return;
      try {
        const status = await figmaApi.getFigmaStatus(accessToken);
        if (status.linked) {
          setFigmaLinked(true);
          if (!cached) fetchItems();
        }
      } catch { /* not linked */ }
    };
    checkStatus();
  }, [accessToken]);

  const fetchItems = async () => {
    if (!accessToken) return;
    setFetchingItems(true);
    setFromCache(false);
    try {
      const projects = await figmaApi.fetchFigmaItems(accessToken);
      setFigmaProjects(projects);
      writeCache(projects);
      if (projects.length > 0) setExpandedProjects(new Set([projects[0].id]));
    } catch (err: any) {
      toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
    } finally {
      setFetchingItems(false);
    }
  };

  const handleLinkAndFetch = async () => {
    if (!pat.trim() || !teamId.trim()) {
      toast({ title: "Missing fields", description: "Please enter both PAT token and Team ID.", variant: "destructive" });
      return;
    }
    if (!accessToken) return;
    setLinkingFigma(true);
    try {
      clearCache();
      await figmaApi.linkFigma(pat.trim(), teamId.trim(), accessToken);
      setFigmaLinked(true);
      toast({ title: "Figma linked!", description: "Fetching your projects and files…" });
      await fetchItems();
    } catch (err: any) {
      toast({ title: "Link failed", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setLinkingFigma(false);
    }
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalFiles = figmaProjects.reduce((acc, p) => acc + (p.files?.length ?? 0), 0);

  return (
    <div>
      {/* Back breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-1.5 mb-5 text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: "#1B3C71" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Figma Design
      </button>

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #1B3C71 0%, #2E6BC4 100%)" }}>
            <Folder className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>Figma Items</h1>
            <p className="text-xs mt-0.5" style={{ color: "#858585" }}>Browse your team's Figma projects and files</p>
          </div>
        </div>
        {figmaLinked && (
          <div className="flex items-center gap-2">
            {fromCache && !fetchingItems && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: "#FEF9C3", color: "#854D0E" }}>
                cached
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={fetchItems} disabled={fetchingItems}>
              <RefreshCw className={`w-4 h-4 ${fetchingItems ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Credentials card */}
      <div className={`rounded-2xl mb-6 border overflow-hidden transition-colors ${figmaLinked ? "border-[#BBF7D0]" : "border-[#E5E7EB]"}`}>
        {figmaLinked ? (
          /* ── Linked state ── */
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 bg-[#F0FDF4]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800">Figma account connected</p>
                <p className="text-xs text-green-600">Credentials are saved — projects load automatically on visit.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-green-200 text-green-700 hover:bg-green-50" onClick={() => setFigmaLinked(false)}>
              Re-link
            </Button>
          </div>
        ) : (
          /* ── Unlinked state ── */
          <div className="bg-white p-5">
            {/* Card header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
                <Folder className="w-4 h-4" style={{ color: "#1B3C71" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Connect your Figma account</p>
                <p className="text-xs" style={{ color: "#858585" }}>Two steps — takes under a minute</p>
              </div>
            </div>

            {/* Step inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#374151" }}>
                  <span className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#1B3C71" }}>1</span>
                  Personal Access Token
                </label>
                <input
                  type="password"
                  placeholder="figd_••••••••••••••••"
                  value={pat}
                  onChange={e => setPat(e.target.value)}
                  className="w-full h-10 px-3 border border-[#DEDCDC] rounded-xl bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3C71]/30 text-sm font-mono"
                />
                <p className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>Figma → Settings → Account → Personal Access Tokens</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#374151" }}>
                  <span className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#1B3C71" }}>2</span>
                  Team ID
                </label>
                <input
                  type="text"
                  placeholder="1234567890"
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  className="w-full h-10 px-3 border border-[#DEDCDC] rounded-xl bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3C71]/30 text-sm font-mono"
                />
                <p className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>figma.com/files/team/<strong style={{ color: "#6B7280" }}>TEAM_ID</strong>/…</p>
              </div>
            </div>

            <Button
              onClick={handleLinkAndFetch}
              disabled={linkingFigma}
              className="w-full h-11 gap-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "#1B3C71", color: "white" }}
            >
              {linkingFigma
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                : <><Folder className="w-4 h-4" /> Connect &amp; Fetch Projects</>}
            </Button>
          </div>
        )}
      </div>

      {/* Projects + files */}
      {fetchingItems ? (
        /* ── Card-shaped skeletons ── */
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 bg-[#F8F9FC] flex items-center gap-3">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(j => (
                  <div key={j} className="rounded-2xl overflow-hidden border border-[#E5E7EB]">
                    <Skeleton className="w-full" style={{ aspectRatio: "16/9" }} />
                    <div className="p-3 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : figmaProjects.length === 0 && figmaLinked ? (
        /* ── Empty state ── */
        <div className="border border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center py-16 bg-[#FAFAFA]">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
            <Folder className="w-8 h-8" style={{ color: "#1B3C71" }} />
          </div>
          <p className="text-sm font-bold mb-1" style={{ color: "#1A1A1A" }}>No projects found</p>
          <p className="text-xs" style={{ color: "#858585" }}>This team has no projects yet, or the Team ID is incorrect.</p>
        </div>
      ) : figmaProjects.length > 0 ? (
        <div>
          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              {figmaProjects.length} {figmaProjects.length === 1 ? "project" : "projects"}
            </span>
            <span style={{ color: "#D1D5DB" }}>·</span>
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              {totalFiles} {totalFiles === 1 ? "file" : "files"}
            </span>
          </div>

          <div className="space-y-4">
            {figmaProjects.map(project => {
              const isExpanded = expandedProjects.has(project.id);
              return (
                <div key={project.id} className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
                  {/* Project header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 bg-[#F8F9FC] hover:bg-[#EEF2F9] transition-colors"
                    onClick={() => toggleProject(project.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
                        <Folder className="w-3.5 h-3.5" style={{ color: "#1B3C71" }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#1A1A1A" }}>{project.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#E5EEFF", color: "#1B3C71" }}>
                        {project.files?.length ?? 0} files
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} style={{ color: "#9CA3AF" }} />
                  </button>

                  {/* Files grid */}
                  {isExpanded && (
                    <div className="p-4">
                      {!project.files || project.files.length === 0 ? (
                        <p className="text-sm text-center py-6" style={{ color: "#858585" }}>No files in this project.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {project.files.map(file => (
                            <div key={file.key} className="group border border-[#E5E7EB] rounded-2xl overflow-hidden hover:shadow-xl hover:border-[#1B3C71]/40 transition-all duration-300 bg-white">
                              {/* Thumbnail with hover overlay */}
                              <div className="relative overflow-hidden bg-gradient-to-br from-[#EEF2F9] to-[#D1DFFE]" style={{ aspectRatio: "16/9" }}>
                                {file.thumbnail_url ? (
                                  <img
                                    src={file.thumbnail_url}
                                    alt={file.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(27,60,113,0.12)" }}>
                                      <ImageOff className="w-5 h-5" style={{ color: "#1B3C71" }} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: "#6B7280" }}>No preview</span>
                                  </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "rgba(27,60,113,0.65)" }}>
                                  <a
                                    href={`https://www.figma.com/file/${file.key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 text-sm font-bold shadow-lg"
                                    style={{ color: "#1B3C71" }}
                                  >
                                    <ExternalLink className="w-4 h-4" /> Open in Figma
                                  </a>
                                </div>
                              </div>

                              {/* File info strip */}
                              <div className="px-4 py-3 border-t border-[#F3F4F6]">
                                <p className="text-sm font-bold truncate mb-0.5" style={{ color: "#1A1A1A" }}>{file.name}</p>
                                <p className="text-xs" style={{ color: "#9CA3AF" }}>Modified {formatFigmaDate(file.last_modified)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ─── View 3: Generate Prompt (Phase 1 feature) ────────────────────────────────

const GeneratePromptView = ({ onBack }: { onBack: () => void }) => {
  const { accessToken } = useAuth();
  const { selectedProject } = useAppState();
  const { toast } = useToast();

  const [issues, setIssues] = useState<DisplayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<DisplayIssue | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const mapJiraIssueToDisplayIssue = (jiraIssue: JiraIssue): DisplayIssue => {
    const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const getPriority = (n?: string) => {
      if (!n) return "none";
      const l = n.toLowerCase();
      return l.includes("high") || l.includes("critical") || l.includes("blocker") ? "high" : "medium";
    };
    const extractText = (desc: any): string => {
      if (!desc) return "No description provided";
      if (typeof desc === "string") return desc;
      if (desc.type === "doc" && desc.content) {
        const texts: string[] = [];
        const walk = (n: any) => { if (n.type === "text" && n.text) texts.push(n.text); else if (n.content) n.content.forEach(walk); };
        desc.content.forEach(walk);
        return texts.join(" ") || "No description provided";
      }
      return "No description provided";
    };
    const baseUrl = jiraIssue.self?.split("/rest/api")[0] ?? "";
    return {
      id: jiraIssue.key,
      title: jiraIssue.fields.summary || "Untitled",
      type: jiraIssue.fields.issuetype?.name || "Task",
      priority: getPriority(jiraIssue.fields.priority?.name),
      status: jiraIssue.fields.status?.name || "Unknown",
      assignee: jiraIssue.fields.assignee?.displayName || "Unassigned",
      reporter: jiraIssue.fields.reporter?.displayName || "Unknown",
      points: jiraIssue.fields.customfield_10016?.toString() || "0",
      created: jiraIssue.fields.created ? formatDate(jiraIssue.fields.created) : "Unknown",
      updated: jiraIssue.fields.updated ? formatDate(jiraIssue.fields.updated) : "Unknown",
      description: extractText(jiraIssue.fields.description),
      sprint: jiraIssue.fields.sprint?.name || "No sprint",
      labels: jiraIssue.fields.labels || [],
      url: baseUrl ? `${baseUrl}/browse/${jiraIssue.key}` : "#",
      parentKey: jiraIssue.fields.parent?.key,
      parentTitle: jiraIssue.fields.parent?.fields?.summary,
    };
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedProject?.jira_project_key || !accessToken) { setLoading(false); return; }
      setLoading(true);
      try {
        const res = await integrationsApi.getJiraIssues(selectedProject.jira_project_key, accessToken);
        const mapped = res.issues.map(mapJiraIssueToDisplayIssue);
        setIssues(mapped);
        if (mapped.length > 0) setSelectedIssue(mapped[0]);
      } catch {
        toast({ title: "Error loading issues", description: "Failed to fetch Jira issues.", variant: "destructive" });
      } finally { setLoading(false); }
    };
    load();
    setGeneratedPrompt("");
  }, [selectedProject, accessToken]);

  useEffect(() => { setGeneratedPrompt(""); setPromptCopied(false); }, [selectedIssue?.id]);

  const filteredIssues = issues.filter(i =>
    (searchTerm === "" || i.title.toLowerCase().includes(searchTerm.toLowerCase()) || i.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (typeFilter === "all-type" || i.type.toLowerCase() === typeFilter)
  );

  const organizedIssues = (() => {
    const epics = filteredIssues.filter(i => i.type.toLowerCase() === "epic");
    const stories = filteredIssues.filter(i => i.type.toLowerCase() !== "epic" && i.parentKey);
    const orphans = filteredIssues.filter(i => i.type.toLowerCase() !== "epic" && !i.parentKey);
    return [
      ...epics.map(epic => ({ epic, children: stories.filter(s => s.parentKey === epic.id) })),
      ...orphans.map(issue => ({ issue })),
    ];
  })();

  const toggleEpic = (key: string) => {
    setExpandedEpics(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const getTypeBadge = (t: string) => ({ Story: "bg-white text-green-700", Bug: "bg-white text-red-700", Task: "bg-white text-blue-700", Epic: "bg-white text-purple-700" }[t] || "bg-white text-gray-700");
  const getStatusBadge = (s: string) => ({ "In Progress": "bg-white text-blue-700", "To-do": "bg-white text-gray-700", "Under Review": "bg-white text-yellow-700", Done: "bg-white text-green-700" }[s] || "bg-white text-gray-700");
  const getPriorityIcon = (p: string) => p === "high" ? <ArrowUp className="w-3 h-3" style={{ color: "#1B3C71" }} /> : <ArrowUp className="w-3 h-3 text-yellow-500 rotate-45" />;

  const handleGenerate = async () => {
    if (!selectedIssue || !selectedProject || generating) return;
    setGenerating(true);
    setGeneratedPrompt("");
    try {
      const result = await figmaApi.generatePrompt({
        project_id: selectedProject.project_id,
        jira_story: { key: selectedIssue.id, title: selectedIssue.title, description: selectedIssue.description, type: selectedIssue.type, priority: selectedIssue.priority, acceptance_criteria: "" },
        max_chunks: 5,
      }, accessToken!);
      setGeneratedPrompt(result.prompt);
      toast({ title: "Prompt generated", description: "Your Figma design prompt is ready." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleCopy = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 3000);
    toast({ title: "Copied!", description: "Paste the prompt into Figma AI or any design tool." });
  };

  return (
    <div>
      {/* Back button + title */}
      <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm hover:opacity-70 transition-opacity" style={{ color: "#1B3C71" }}>
        <ArrowLeft className="w-4 h-4" /> Back to Figma Design
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#3B3B3B" }}>Generate Prompt</h1>
        <p className="text-sm mt-0.5" style={{ color: "#858585" }}>
          Select a Jira story to generate a Figma design prompt enriched with your Confluence documentation.
        </p>
      </div>

      {/* Guard states */}
      {!selectedProject ? (
        <div className="border border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center h-48 text-center px-4 bg-[#FAFAFA]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
            <PenTool className="w-6 h-6" style={{ color: "#1B3C71" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#3B3B3B" }}>No project selected</p>
          <p className="text-xs mt-1" style={{ color: "#858585" }}>Select a project from the top bar to begin.</p>
        </div>
      ) : !selectedProject.jira_project_key ? (
        <div className="border border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center h-48 text-center px-4 bg-[#FAFAFA]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
            <PenTool className="w-6 h-6" style={{ color: "#1B3C71" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#3B3B3B" }}>No Jira project linked</p>
          <p className="text-xs mt-1" style={{ color: "#858585" }}>Link a Jira project in project settings to see stories.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Left: story list */}
          <div className="w-full lg:w-80 xl:w-96">
            <div className="border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 bg-white max-h-[670px] overflow-y-auto">
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" placeholder="Search stories" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 border border-[#DEDCDC] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-type">All Types</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <h3 className="font-semibold text-sm mb-3">Stories</h3>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : filteredIssues.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "#858585" }}>No issues found.</p>
              ) : (
                <div className="space-y-2">
                  {organizedIssues.map((item) => {
                    if ("epic" in item) {
                      const { epic, children } = item;
                      const isExp = expandedEpics.has(epic.id);
                      return (
                        <div key={epic.id}>
                          <div className={`p-3 border rounded-xl cursor-pointer transition-colors ${selectedIssue?.id === epic.id ? "border-[#1B3C71] bg-[#EEF2F9] shadow-sm" : "border-[#E5E7EB] hover:bg-[#F8F9FC]"}`}
                            onClick={() => setSelectedIssue(epic)}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <button onClick={e => { e.stopPropagation(); toggleEpic(epic.id); }} className="hover:bg-gray-200 rounded p-0.5">
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExp ? "" : "-rotate-90"}`} />
                                </button>
                                <span className="text-xs font-medium" style={{ color: "#6C6C6C" }}>{epic.id}</span>
                                <Badge className={`${getTypeBadge(epic.type)} text-xs px-2 py-0`}>{epic.type}</Badge>
                                {children.length > 0 && <span className="text-xs text-gray-500">({children.length})</span>}
                              </div>
                              {getPriorityIcon(epic.priority)}
                            </div>
                            <h4 className="font-medium text-base line-clamp-2 mb-2" style={{ color: "#3B3B3B" }}>{epic.title}</h4>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 min-w-0 flex-1" style={{ color: "#747474" }}>
                                <Avatar className="h-4 w-4 flex-shrink-0"><AvatarFallback className="text-xs">{epic.assignee.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                                <span className="truncate">{epic.assignee}</span>
                              </div>
                              <Badge className={`${getStatusBadge(epic.status)} text-xs px-2 py-0 flex-shrink-0 ml-2`}>{epic.status}</Badge>
                            </div>
                          </div>
                          {isExp && children.length > 0 && (
                            <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                              {children.map(story => (
                                <div key={story.id} className={`p-2 border rounded-xl cursor-pointer transition-colors ${selectedIssue?.id === story.id ? "border-[#1B3C71] bg-[#EEF2F9] shadow-sm" : "border-[#E5E7EB] hover:bg-[#F8F9FC]"}`}
                                  onClick={() => setSelectedIssue(story)}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium" style={{ color: "#6C6C6C" }}>{story.id}</span>
                                      <Badge className={`${getTypeBadge(story.type)} text-xs px-1.5 py-0`}>{story.type}</Badge>
                                    </div>
                                    {getPriorityIcon(story.priority)}
                                  </div>
                                  <h4 className="text-sm line-clamp-2 mb-1" style={{ color: "#3B3B3B" }}>{story.title}</h4>
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1 min-w-0 flex-1" style={{ color: "#747474" }}>
                                      <Avatar className="h-3 w-3 flex-shrink-0"><AvatarFallback className="text-xs">{story.assignee.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                                      <span className="truncate text-xs">{story.assignee}</span>
                                    </div>
                                    <Badge className={`${getStatusBadge(story.status)} text-xs px-1.5 py-0 flex-shrink-0 ml-2`}>{story.status}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      const { issue } = item;
                      return (
                        <div key={issue.id} className={`p-3 border rounded-xl cursor-pointer transition-colors ${selectedIssue?.id === issue.id ? "border-[#1B3C71] bg-[#EEF2F9] shadow-sm" : "border-[#E5E7EB] hover:bg-[#F8F9FC]"}`}
                          onClick={() => setSelectedIssue(issue)}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium" style={{ color: "#6C6C6C" }}>{issue.id}</span>
                              <Badge className={`${getTypeBadge(issue.type)} text-xs px-2 py-0`}>{issue.type}</Badge>
                            </div>
                            {getPriorityIcon(issue.priority)}
                          </div>
                          <h4 className="font-medium text-base line-clamp-2 mb-2" style={{ color: "#3B3B3B" }}>{issue.title}</h4>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 min-w-0 flex-1" style={{ color: "#747474" }}>
                              <Avatar className="h-4 w-4 flex-shrink-0"><AvatarFallback className="text-xs">{issue.assignee.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                              <span className="truncate">{issue.assignee}</span>
                            </div>
                            <Badge className={`${getStatusBadge(issue.status)} text-xs px-2 py-0 flex-shrink-0 ml-2`}>{issue.status}</Badge>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: story detail + generate */}
          <div className="flex-1 min-w-0">
            {!selectedIssue ? (
              <div className="border border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center h-64 bg-[#FAFAFA]">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #EEF2F9, #D1DFFE)" }}>
                  <PenTool className="w-7 h-7" style={{ color: "#1B3C71" }} />
                </div>
                <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Select a story</p>
                <p className="text-xs mt-1" style={{ color: "#858585" }}>Pick a Jira story from the left panel.</p>
              </div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white">
                {/* Story header */}
                <div className="p-5 border-b border-[#F3F4F6]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "#EEF2F9", color: "#1B3C71" }}>{selectedIssue.id}</span>
                        <Badge className={`${getTypeBadge(selectedIssue.type)} text-xs px-2 py-0`}>{selectedIssue.type}</Badge>
                        <Badge className={`${getStatusBadge(selectedIssue.status)} text-xs px-2 py-0`}>{selectedIssue.status}</Badge>
                        <div className="flex items-center gap-1">{getPriorityIcon(selectedIssue.priority)}<span className="text-xs capitalize" style={{ color: "#858585" }}>{selectedIssue.priority}</span></div>
                      </div>
                      <h2 className="text-lg font-bold tracking-tight" style={{ color: "#1A1A1A" }}>{selectedIssue.title}</h2>
                    </div>
                    {selectedIssue.url && selectedIssue.url !== "#" && (
                      <a href={selectedIssue.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0 rounded-xl">
                          <ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">Open in Jira</span>
                        </Button>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "#858585" }}>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{selectedIssue.assignee.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                      <span>{selectedIssue.assignee}</span>
                    </div>
                    {selectedIssue.sprint !== "No sprint" && (
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>{selectedIssue.sprint}</span>
                    )}
                    <span>Updated {selectedIssue.updated}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="p-5 border-b border-[#F3F4F6]">
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{selectedIssue.description}</p>
                </div>

                {/* Generate section */}
                <div className="p-5" style={{ background: "linear-gradient(135deg, #F8F9FC 0%, #EEF2F9 100%)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Generate Figma Prompt</p>
                      <p className="text-xs mt-0.5" style={{ color: "#858585" }}>Confluence RAG → Claude AI → complete design brief</p>
                    </div>
                    <Button onClick={handleGenerate} disabled={generating} className="gap-2 flex-shrink-0 rounded-xl" style={{ backgroundColor: "#1B3C71", color: "white" }}>
                      {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><PenTool className="w-4 h-4" /> Generate</>}
                    </Button>
                  </div>
                </div>

                {/* Generated prompt output */}
                {generatedPrompt && (
                  <div className="border-t border-[#E5E7EB]">
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "linear-gradient(90deg, #1B3C71, #2E6BC4)" }}>
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-white/80" />
                        <span className="text-sm font-semibold text-white">Generated Figma Prompt</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleCopy}
                        className="gap-1.5 rounded-xl font-semibold transition-all duration-200"
                        style={promptCopied
                          ? { backgroundColor: "#16a34a", color: "#fff", border: "none" }
                          : { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)" }
                        }
                      >
                        {promptCopied
                          ? <><CheckCircle2 className="w-4 h-4" /> Copied!</>
                          : <><Copy className="w-4 h-4" /> Copy Prompt</>}
                      </Button>
                    </div>
                    <div className="p-5 font-mono text-xs leading-relaxed overflow-y-auto bg-[#FAFAFA]"
                      style={{ maxHeight: "420px", color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {generatedPrompt}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
