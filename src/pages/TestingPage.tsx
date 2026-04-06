import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState } from "@/contexts/AppStateContext";
import { fetchConfluencePages, type ConfluencePage } from "@/services/confluenceApi";
import { testGenerationApi, type FeatureFile, type ParsedScenario } from "@/services/testGenerationApi";
import { colors } from '@/config/theme';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  FlaskConical,
  GitBranch,
  Upload,
  Check,
  FileText,
  Search,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  XCircle,
  Eye,
  EyeOff,
  Info,
  Wifi,
  Terminal,
  Settings2,
  Plug,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoverageItem {
  id: string;
  name: string;
  covered: boolean;
  testCaseCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract test case counts per TS/SC-ID from the pasted Gherkin output.
 *
 * Strategy:
 * 1. First try to parse the COVERAGE SUMMARY that the AI writes at the bottom.
 *    It contains lines like "TS-001: 22 test cases" which are the authoritative counts.
 * 2. If no summary is found, fall back to checking which @TS-XXX tags appear
 *    before Feature: blocks (presence only, count = 1 as a boolean indicator).
 */
const parseScIdTagsFromGherkin = (gherkin: string): Map<string, number> => {
  const tagMap = new Map<string, number>();

  // Strategy 1: Parse the coverage summary comments at the bottom
  // Matches lines like: "#    - TS-001: 22 test cases" or "# TS-001: 22 test cases"
  const summaryRegex = /#\s*[-•]?\s*((?:TS|SC)-\d{1,4}):\s*(\d+)\s*test\s*case/gi;
  let summaryMatch;
  while ((summaryMatch = summaryRegex.exec(gherkin)) !== null) {
    const id = summaryMatch[1].toUpperCase();
    const count = parseInt(summaryMatch[2], 10);
    if (!isNaN(count) && count > 0) {
      tagMap.set(id, count);
    }
  }

  // If we found counts from the summary, use those — they're authoritative
  if (tagMap.size > 0) return tagMap;

  // Strategy 2: Fallback — just detect which TS/SC tags appear before Feature: lines
  // and mark them as covered (count = 1) so the coverage matrix at least shows green/red
  const lines = gherkin.split("\n");
  let pendingTags: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;

    // Collect tags from tag lines
    const tagRegex = /@((?:SC|TS)-\d{1,4})\b/gi;
    let m;
    const lineTags: string[] = [];
    while ((m = tagRegex.exec(trimmed)) !== null) {
      lineTags.push(m[1].toUpperCase());
    }

    if (lineTags.length > 0 && !/^\s*Scenario/i.test(trimmed) && !/^\s*Feature:/i.test(trimmed)) {
      pendingTags = [...new Set(lineTags)];
      continue;
    }

    // When we hit Feature:, mark each pending tag as covered
    if (/^\s*Feature:/i.test(trimmed)) {
      for (const tag of pendingTags) {
        if (!tagMap.has(tag)) tagMap.set(tag, 1);
      }
      pendingTags = [];
    }
  }

  return tagMap;
};

/** Parse Gherkin text to extract scenario names */
const parseGherkinScenarios = (gherkin: string): string[] => {
  const scenarioRegex = /^\s*Scenario(?:\s+Outline)?:\s*(.+)$/gm;
  const matches: string[] = [];
  let m;
  while ((m = scenarioRegex.exec(gherkin)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
};

/** Parse Gherkin text to extract Feature names */
const parseGherkinFeatures = (gherkin: string): string[] => {
  const featureRegex = /^\s*Feature:\s*(.+)$/gm;
  const matches: string[] = [];
  let m;
  while ((m = featureRegex.exec(gherkin)) !== null) {
    matches.push(m[1].trim());
  }
  return matches;
};

/**
 * Validate basic Gherkin syntax.
 * Returns list of issues (empty = valid).
 */
const validateGherkinSyntax = (gherkin: string): string[] => {
  const issues: string[] = [];
  const trimmed = gherkin.trim();
  if (!trimmed) return ["Empty content"];

  if (!/^\s*Feature:/m.test(trimmed)) {
    issues.push("Missing 'Feature:' declaration");
  }
  if (!/^\s*Scenario(?:\s+Outline)?:/m.test(trimmed)) {
    issues.push("Missing 'Scenario:' block");
  }
  const hasGWT =
    /^\s*Given\s/m.test(trimmed) ||
    /^\s*When\s/m.test(trimmed) ||
    /^\s*Then\s/m.test(trimmed);
  if (!hasGWT) {
    issues.push("Missing Given/When/Then steps");
  }
  return issues;
};

/**
 * Split Gherkin text into per-SC-ID feature files.
 * Groups content by @SC-XX tags. If a Feature block has multiple tags,
 * it's included in all tagged files.
 */
const splitGherkinIntoFeatureFiles = (gherkin: string, scenarios: ParsedScenario[]): FeatureFile[] => {
  const files: FeatureFile[] = [];
  const lines = gherkin.split("\n");

  // Find all Feature blocks with their line ranges
  const featureBlocks: { startIdx: number; endIdx: number; tags: string[]; content: string }[] = [];
  let currentStart = -1;
  let currentTags: string[] = [];
  let tagBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Collect tag lines
    if (/^\s*@/.test(line)) {
      tagBuffer.push(line);
      continue;
    }

    if (/^\s*Feature:/.test(line)) {
      // Close previous block
      if (currentStart >= 0) {
        featureBlocks.push({
          startIdx: currentStart,
          endIdx: i - tagBuffer.length - 1,
          tags: currentTags,
          content: "",
        });
      }
      currentStart = Math.max(0, i - tagBuffer.length);
      // Extract SC/TS tags
      const allTagText = tagBuffer.join(" ") + " " + line;
      const tagMatches = allTagText.match(/@((?:SC|TS)-\d{1,4})/gi) || [];
      currentTags = tagMatches.map((t) => t.replace("@", "").toUpperCase());
      tagBuffer = [];
    } else {
      tagBuffer = [];
    }
  }

  // Close last block
  if (currentStart >= 0) {
    featureBlocks.push({
      startIdx: currentStart,
      endIdx: lines.length - 1,
      tags: currentTags,
      content: "",
    });
  }

  // Extract content for each block
  for (const block of featureBlocks) {
    block.content = lines.slice(block.startIdx, block.endIdx + 1).join("\n").trim();
  }

  // Group by SC-ID
  const scMap = new Map<string, string[]>();
  for (const block of featureBlocks) {
    if (block.tags.length === 0) {
      // No tags — put in a generic file
      if (!scMap.has("UNTAGGED")) scMap.set("UNTAGGED", []);
      scMap.get("UNTAGGED")!.push(block.content);
    } else {
      for (const tag of block.tags) {
        if (!scMap.has(tag)) scMap.set(tag, []);
        scMap.get(tag)!.push(block.content);
      }
    }
  }

  // If no feature blocks were found, return the whole thing as one file
  if (featureBlocks.length === 0) {
    files.push({ filename: "test_cases.feature", content: gherkin.trim() });
    return files;
  }

  // Build files
  for (const [scId, contents] of scMap.entries()) {
    const scenario = scenarios.find((s) => s.id === scId);
    const safeName = scenario
      ? scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
      : scId.toLowerCase().replace("-", "_");
    const filename = scId === "UNTAGGED" ? "untagged_tests.feature" : `${scId.replace("-", "_")}_${safeName}.feature`;
    files.push({ filename: filename.toLowerCase(), content: contents.join("\n\n") });
  }

  return files;
};

// buildDynamicPrompt is now handled server-side by Bedrock via /api/test/parse-scenarios

// ─── Sub-components ──────────────────────────────────────────────────────────

const StepBadge = ({ step, active, done }: { step: number; active: boolean; done: boolean }) => (
  <div
    className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 transition-all"
    style={{
      backgroundColor: done ? "#16a34a" : active ? colors.brand : "#e5e7eb",
      color: done || active ? "#fff" : "#9ca3af",
    }}
  >
    {done ? <Check className="w-4 h-4" /> : step}
  </div>
);

const StepConnector = ({ done }: { done: boolean }) => (
  <div className="flex-1 h-0.5 mx-3 transition-all rounded-full" style={{ backgroundColor: done ? "#16a34a" : "#e5e7eb" }} />
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const TestingPage = () => {
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const { selectedProject } = useAppState();

  // Initial setup: user picks whether MCP is configured
  const [mcpSetup, setMcpSetup] = useState<"pending" | "configured" | "not-configured">("pending");

  // Mode: "manual" (copy-paste) or "mcp" (AI IDE integration)
  const [mode, setMode] = useState<"manual" | "mcp">("manual");

  // Step 1: Select scenario page & build prompt
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [parsedScenarios, setParsedScenarios] = useState<ParsedScenario[]>([]);
  const [dynamicPrompt, setDynamicPrompt] = useState("");
  const [scenarioPageTitle, setScenarioPageTitle] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // MCP mode state
  const mcpListening = mode === "mcp" && !!dynamicPrompt;

  // Step 2: Paste Gherkin & deliver
  const [pastedGherkin, setPastedGherkin] = useState("");
  const [isPushingConfluence, setIsPushingConfluence] = useState(false);
  const [pushedToConfluence, setPushedToConfluence] = useState(false);
  const [confluencePageUrl, setConfluencePageUrl] = useState<string | null>(null);

  // GitHub push state
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubBranch, setGithubBranch] = useState("test/auto-generated");
  const [isPushingGitHub, setIsPushingGitHub] = useState(false);
  const [pushedToGitHub, setPushedToGitHub] = useState(false);
  const [githubPrUrl, setGithubPrUrl] = useState<string | null>(null);
  const [githubBranchUrl, setGithubBranchUrl] = useState<string | null>(null);
  const [showGithubToken, setShowGithubToken] = useState(false);

  const step1Done = !!dynamicPrompt;

  // Derived: Gherkin parsing & validation
  const gherkinScenarios = useMemo(() => parseGherkinScenarios(pastedGherkin), [pastedGherkin]);
  const gherkinFeatures = useMemo(() => parseGherkinFeatures(pastedGherkin), [pastedGherkin]);
  const gherkinValidation = useMemo(
    () => (pastedGherkin.trim() ? validateGherkinSyntax(pastedGherkin) : []),
    [pastedGherkin]
  );
  const isGherkinValid = pastedGherkin.trim().length > 0 && gherkinValidation.length === 0;

  // Derived: Coverage matrix
  const scIdTagCounts = useMemo(() => parseScIdTagsFromGherkin(pastedGherkin), [pastedGherkin]);
  const coverageMatrix: CoverageItem[] = useMemo(() => {
    if (parsedScenarios.length === 0) return [];
    return parsedScenarios.map((s) => ({
      id: s.id,
      name: s.name,
      covered: scIdTagCounts.has(s.id),
      testCaseCount: scIdTagCounts.get(s.id) || 0,
    }));
  }, [parsedScenarios, scIdTagCounts]);

  const coveredCount = coverageMatrix.filter((c) => c.covered).length;
  const totalCount = coverageMatrix.length;

  // Derived: feature files for GitHub push
  const featureFiles = useMemo(
    () => (isGherkinValid ? splitGherkinIntoFeatureFiles(pastedGherkin, parsedScenarios) : []),
    [pastedGherkin, parsedScenarios, isGherkinValid]
  );

  const step2Done = pushedToConfluence || pushedToGitHub;

  // Coverage summary string for metadata
  const coverageSummaryText = useMemo(() => {
    if (totalCount === 0) return `${gherkinFeatures.length} test scenarios, ${gherkinScenarios.length} test cases`;
    return `${coveredCount}/${totalCount} test scenarios covered, ${gherkinScenarios.length} test cases`;
  }, [coveredCount, totalCount, gherkinFeatures.length, gherkinScenarios.length]);

  // ── Load Confluence pages ──
  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      setIsLoadingPages(true);
      try {
        const spaceKey = selectedProject?.confluence_space_key || "SO";
        const fetched = await fetchConfluencePages(accessToken, spaceKey);
        setPages(fetched);
      } catch {
        toast({ title: "Failed to load pages", description: "Could not fetch Confluence pages", variant: "destructive" });
      } finally {
        setIsLoadingPages(false);
      }
    };
    load();
  }, [accessToken, selectedProject]);

  // ── SSE listener for MCP mode ──
  // Starts listening immediately when MCP mode is selected — no Step 1 needed.
  // The IDE's MCP server fetches scenarios and generates Gherkin itself,
  // then sends it back via the backend SSE endpoint.
  useEffect(() => {
    if (mode !== "mcp" || !selectedProject || !accessToken || pastedGherkin) return;

    const controller = testGenerationApi.listenForTestCases(
      selectedProject.project_id,
      accessToken,
      (gherkin) => {
        setPastedGherkin(gherkin);
        toast({ title: "Test cases received", description: "Your AI IDE submitted test cases via MCP" });
      },
      (error) => {
        console.error("[SSE] Error:", error);
      },
    );

    return () => controller.abort();
  }, [mode, selectedProject, accessToken, pastedGherkin]);

  // Filter pages — prioritize pages with "Test Scenario" in the title
  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const testScenarioPages = filteredPages.filter((p) =>
    p.title.toLowerCase().includes("test scenario")
  );
  const otherPages = filteredPages.filter((p) =>
    !p.title.toLowerCase().includes("test scenario")
  );
  const sortedPages = [...testScenarioPages, ...otherPages];

  // ── Handlers ──

  const handleSelectPage = async (pageId: string) => {
    setSelectedPageId(pageId);
    setPageDropdownOpen(false);
    setParsedScenarios([]);
    setDynamicPrompt("");
    setScenarioPageTitle("");
    setPromptCopied(false);
    setPastedGherkin("");
    setPushedToConfluence(false);
    setPushedToGitHub(false);
    setConfluencePageUrl(null);
    setGithubPrUrl(null);
    setGithubBranchUrl(null);

    if (!accessToken || !selectedProject) return;
    setIsLoadingContent(true);
    try {
      // Call Bedrock to parse scenarios and generate the prompt
      const result = await testGenerationApi.parseScenarios(
        pageId,
        selectedProject.project_id,
        accessToken
      );
      setParsedScenarios(result.scenarios);
      setDynamicPrompt(result.prompt);
      setScenarioPageTitle(result.page_title);
      toast({
        title: "Scenarios parsed",
        description: `Found ${result.scenarios.length} test scenario(s) — prompt ready`,
      });
    } catch (error: any) {
      toast({ title: "Failed to parse scenarios", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!dynamicPrompt) return;
    navigator.clipboard.writeText(dynamicPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 3000);
    toast({ title: "Prompt copied", description: "Paste it into your AI IDE — it will analyse your code automatically" });
  };

  const handlePushToConfluence = async () => {
    if (!pastedGherkin.trim() || !selectedProject || !accessToken) return;
    setIsPushingConfluence(true);
    try {
      const now = new Date().toISOString().slice(0, 10);
      const projectName = selectedProject.project_name || "Project";
      const featureName = scenarioPageTitle || "Testing";
      const title = `Test Cases - ${projectName} - ${featureName} - ${now}`;

      const response = await testGenerationApi.pushToConfluence(
        selectedProject.project_id,
        title,
        pastedGherkin,
        accessToken,
        scenarioPageTitle,
        coverageSummaryText
      );
      setPushedToConfluence(true);
      setConfluencePageUrl(response.web_url);
      toast({ title: "Pushed to Confluence", description: `Page "${response.page_title}" created` });
    } catch (error: any) {
      toast({ title: "Push failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPushingConfluence(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (!repoUrl.trim()) {
      toast({ title: "Repository URL required", description: "Enter the GitHub repository URL", variant: "destructive" });
      return;
    }
    if (!githubToken.trim()) {
      toast({ title: "GitHub token required", description: "Enter a GitHub PAT with repo scope", variant: "destructive" });
      return;
    }
    if (!selectedProject || !accessToken) return;

    setIsPushingGitHub(true);
    try {
      const result = await testGenerationApi.pushToGitHub(
        selectedProject.project_id,
        githubToken,
        repoUrl,
        featureFiles,
        accessToken,
        githubBranch,
        "tests/features",
        true
      );
      setPushedToGitHub(true);
      setGithubPrUrl(result.pr_url);
      setGithubBranchUrl(result.branch_url);
      toast({
        title: "Pushed to GitHub",
        description: result.pr_url
          ? `PR #${result.pr_number} created with ${result.files.length} feature file(s)`
          : `${result.files.length} file(s) pushed to branch ${result.branch}`,
      });
    } catch (error: any) {
      toast({ title: "GitHub push failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPushingGitHub(false);
    }
  };

  const selectedPageObj = pages.find((p) => p.id === selectedPageId);

  return (
    <MainLayout currentView="testing">
      <div className="min-h-screen" style={{ backgroundColor: "#F7F9FC" }}>

        {/* ── Page Header ── */}
        <div className="px-6 sm:px-8 py-5 border-b border-gray-200 bg-white">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.brand }}>
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: "#1a1a1a" }}>Testing Pipeline</h1>
            </div>
            <p className="text-sm text-gray-500 ml-11">
              Select a test scenario document, generate an AI prompt, collect Gherkin output, and deliver to Confluence + GitHub.
            </p>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6 max-w-4xl">

          {/* ── MCP Setup Selection ── */}
          {mcpSetup === "pending" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.08)` }}>
                <Settings2 className="w-7 h-7" style={{ color: colors.brand }} />
              </div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "#1a1a1a" }}>Choose your testing workflow</h2>
              <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
                Select how your AI IDE sends test cases back to the platform.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">

                {/* ── MCP Configured Card ── */}
                <button
                  onClick={() => { setMcpSetup("configured"); setMode("mcp"); }}
                  className="group relative flex flex-col rounded-xl border-2 border-gray-200 bg-white hover:border-primary hover:shadow-lg transition-all text-left overflow-hidden"
                >
                  {/* Top accent */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: "#16a34a" }} />

                  <div className="p-5 flex flex-col gap-4 flex-1">
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(22, 163, 74, 0.1)" }}>
                        <Plug className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>MCP Configured</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Recommended</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Your AI IDE is connected to the AgentCore MCP server. Gherkin test cases are sent back <span className="font-medium text-gray-700">automatically</span> — no copy-paste needed.
                    </p>

                    {/* Flow steps */}
                    <div className="space-y-2.5 mt-1">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>1</div>
                        <p className="text-xs text-gray-600">Tell your IDE to generate test cases using MCP tools</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>2</div>
                        <p className="text-xs text-gray-600">IDE auto-chains: find scenarios &rarr; get prompt &rarr; generate &rarr; submit back</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: "#16a34a" }}>3</div>
                        <p className="text-xs text-gray-600">Gherkin auto-received here &rarr; review &rarr; push to GitHub / Confluence</p>
                      </div>
                    </div>

                    {/* CTA footer */}
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                      <Wifi className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-600">Auto-receive via MCP</span>
                      <ArrowRight className="w-3.5 h-3.5 text-green-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </button>

                {/* ── MCP Not Configured Card ── */}
                <button
                  onClick={() => { setMcpSetup("not-configured"); setMode("manual"); }}
                  className="group relative flex flex-col rounded-xl border-2 border-gray-200 bg-white hover:border-primary hover:shadow-lg transition-all text-left overflow-hidden"
                >
                  {/* Top accent */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: colors.brand }} />

                  <div className="p-5 flex flex-col gap-4 flex-1">
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.08)` }}>
                        <FileText className="w-5 h-5" style={{ color: colors.brand }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>MCP Not Configured</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.06)`, color: colors.brand }}>Manual workflow</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Copy a generated AI prompt, paste it into any AI IDE (Cursor, Copilot, Claude Code), then <span className="font-medium text-gray-700">paste the Gherkin output back here</span> manually.
                    </p>

                    {/* Flow steps */}
                    <div className="space-y-2.5 mt-1">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>1</div>
                        <p className="text-xs text-gray-600">Select scenario page &rarr; generate AI prompt</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>2</div>
                        <p className="text-xs text-gray-600">Copy prompt &rarr; paste into your AI IDE &rarr; get Gherkin output</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>3</div>
                        <p className="text-xs text-gray-600">Paste .feature output back &rarr; review &rarr; push to GitHub / Confluence</p>
                      </div>
                    </div>

                    {/* CTA footer */}
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                      <Copy className="w-3.5 h-3.5" style={{ color: colors.brand }} />
                      <span className="text-xs font-medium" style={{ color: colors.brand }}>Manual copy & paste</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colors.brand }} />
                    </div>
                  </div>
                </button>

              </div>
            </div>
          )}

          {/* ── Main Pipeline (shown after MCP setup choice) ── */}
          {mcpSetup !== "pending" && (<>

          {/* ── Mode indicator + Change link ── */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {mode === "mcp" ? (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                  <Plug className="w-3 h-3" />
                  MCP Mode
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.06)`, color: colors.brand }}>
                  <Copy className="w-3 h-3" />
                  Manual Mode
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setMcpSetup("pending");
                setMode("manual");
                setSelectedPageId("");
                setParsedScenarios([]);
                setDynamicPrompt("");
                setScenarioPageTitle("");
                setPromptCopied(false);
                setPastedGherkin("");
                setPushedToConfluence(false);
                setPushedToGitHub(false);
                setConfluencePageUrl(null);
                setGithubPrUrl(null);
                setGithubBranchUrl(null);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
            >
              Change workflow
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              MCP MODE — Single card: Listen + Review + Deliver
             ════════════════════════════════════════════════════════════════ */}
          {mode === "mcp" && (
            <Card className="border-gray-200 shadow-sm">
              <div className="h-1 w-full" style={{ backgroundColor: step2Done ? "#16a34a" : pastedGherkin ? colors.brand : "#16a34a" }} />
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(22, 163, 74, 0.1)" }}>
                      <Terminal className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
                        {pastedGherkin ? "Review & Deliver Test Cases" : "Waiting for Test Cases from IDE"}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {step2Done
                          ? "Test cases delivered successfully"
                          : pastedGherkin
                            ? "Review the auto-received Gherkin, then push to Confluence and your Katalon GitHub repo"
                            : "Run the MCP tool command in your AI IDE — test cases will appear here automatically"}
                      </p>
                    </div>
                  </div>
                  {!pastedGherkin && !step2Done && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <div className="relative">
                        <Wifi className="w-4 h-4" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      </div>
                      Listening...
                    </div>
                  )}
                  {step2Done && (
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#16a34a" }}>
                      <CheckCircle2 className="w-4 h-4" />
                      Delivered
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* MCP How-it-works + Command */}
                {!pastedGherkin && (
                  <div className="space-y-4">
                    {/* How it works */}
                    <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-blue-100" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.03)` }}>
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.brand }} />
                      <div className="text-xs text-gray-500 leading-relaxed">
                        <span className="font-medium" style={{ color: colors.brand }}>How it works:</span> Your AI IDE has the AgentCore MCP server connected. When you run the tool command below, the IDE will:
                        <ol className="mt-1.5 space-y-1 list-decimal list-inside text-gray-600">
                          <li>Fetch test scenarios from your project's Confluence space</li>
                          <li>Scan your codebase to understand the implementation</li>
                          <li>Generate Gherkin <code className="text-[10px] bg-gray-100 px-1 rounded font-mono">.feature</code> files with <code className="text-[10px] bg-gray-100 px-1 rounded font-mono">@TS-XXX</code> tags</li>
                          <li>Send the output back here automatically via MCP</li>
                        </ol>
                      </div>
                    </div>

                    {/* Command block */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        Say this in your AI IDE
                      </label>
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#1e293b" }}>
                        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>
                          <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-[11px] text-gray-400 font-mono">Prompt for your AI IDE</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText("Use the MCP tools to generate test cases: first call list_test_scenario_pages to find the scenario page, then get_test_prompt to get the generation instructions, generate the Gherkin .feature files, and finally call submit_test_cases to send them back.");
                              toast({ title: "Prompt copied", description: "Paste it into your AI IDE" });
                            }}
                            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                        <div className="px-4 py-3 font-mono text-xs leading-relaxed" style={{ backgroundColor: "#0f172a", color: "#7dd3fc" }}>
                          Use the MCP tools to generate test cases: first call list_test_scenario_pages to find the scenario page, then get_test_prompt to get the generation instructions, generate the Gherkin .feature files, and finally call submit_test_cases to send them back.
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        <span className="font-medium text-gray-500">MCP tools used:</span>{" "}
                        <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded font-mono">list_test_scenario_pages</code>
                        {" → "}
                        <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded font-mono">get_test_prompt</code>
                        {" → generate → "}
                        <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded font-mono">submit_test_cases</code>
                      </p>
                    </div>

                    {/* Listening indicator */}
                    <div className="rounded-lg border border-green-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 bg-green-50">
                        <div className="relative flex-shrink-0">
                          <Wifi className="w-5 h-5 text-green-600" />
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700">Listening for test cases...</p>
                          <p className="text-xs text-green-600">Gherkin output will appear here automatically when your IDE sends it via MCP</p>
                        </div>
                        <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Received indicator */}
                {pastedGherkin && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-green-700">
                      Test cases received from your IDE — review below and deliver
                    </span>
                  </div>
                )}

                {/* Gherkin Area */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                  {mode === "mcp"
                    ? pastedGherkin ? "Received .feature File Output" : "Awaiting .feature File Output"
                    : "Paste .feature File Output"}
                </label>
                <textarea
                  value={pastedGherkin}
                  onChange={(e) => {
                    setPastedGherkin(e.target.value);
                    setPushedToConfluence(false);
                    setPushedToGitHub(false);
                    setConfluencePageUrl(null);
                    setGithubPrUrl(null);
                    setGithubBranchUrl(null);
                  }}
                  disabled={mode === "mcp" ? false : !dynamicPrompt}
                  placeholder={mode === "mcp"
                    ? "Gherkin test cases will appear here automatically when your AI IDE sends them via MCP...\n\nTell your IDE to generate test cases — it will use the MCP tools automatically."
                    : `@TS-001 @regression\nFeature: Language Detection and Support\n\n  Background:\n    Given the language detection service is running\n    And the NLP models are loaded\n\n  Scenario: Successfully detect Spanish input\n    When I send a POST request to "/api/v1/detect-language" with body:\n      """\n      {"text": "Hola, necesito ayuda"}\n      """\n    Then the response status should be 200\n    And the response field "detected_language" should be "es"\n\n  Scenario: Reject unsupported language\n    When I send a POST request to "/api/v1/detect-language" with body:\n      """\n      {"text": "unsupported"}\n      """\n    Then the response status should be 422`}
                  className="w-full h-52 px-4 py-3 text-sm rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-all font-mono leading-relaxed"
                  style={{ color: "#1a1a1a" }}
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                  onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Gherkin Validation */}
              {pastedGherkin.trim() && gherkinValidation.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700">
                    <span className="font-medium">Gherkin syntax issues:</span>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {gherkinValidation.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Valid Gherkin indicator */}
              {isGherkinValid && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50">
                  <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-green-700">Valid Gherkin syntax detected</span>
                </div>
              )}


              {/* Coverage Matrix */}
              {coverageMatrix.length > 0 && pastedGherkin.trim() && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.04)` }}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" style={{ color: colors.brand }} />
                      <span className="text-sm font-semibold" style={{ color: colors.brand }}>
                        Coverage Matrix
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${totalCount > 0 ? (coveredCount / totalCount) * 100 : 0}%`,
                            backgroundColor: coveredCount === totalCount ? "#16a34a" : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: coveredCount === totalCount ? "#16a34a" : "#f59e0b" }}>
                        {coveredCount}/{totalCount}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {coverageMatrix.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                        {item.covered ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                          style={{
                            backgroundColor: item.covered ? "rgba(22, 163, 74, 0.08)" : "rgba(0,0,0,0.04)",
                            color: item.covered ? "#16a34a" : "#9ca3af",
                          }}
                        >
                          {item.id}
                        </span>
                        <span className={`text-xs flex-1 truncate ${item.covered ? "text-gray-700" : "text-gray-400"}`}>
                          {item.name}
                        </span>
                        {item.covered && (
                          <span className="text-[10px] text-green-600 font-medium flex-shrink-0">
                            {item.testCaseCount} test case{item.testCaseCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {!item.covered && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">not in code</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Push to Confluence ── */}
              {pastedGherkin.trim() && (
                <div className="pt-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Save to Confluence
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handlePushToConfluence}
                      disabled={!isGherkinValid || isPushingConfluence || pushedToConfluence}
                      className="text-white text-sm font-medium"
                      style={pushedToConfluence ? { backgroundColor: "#16a34a" } : { backgroundColor: colors.brand }}
                    >
                      {isPushingConfluence ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pushing...</>
                      ) : pushedToConfluence ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" />Saved to Confluence</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" />Push to Confluence</>
                      )}
                    </Button>
                    {confluencePageUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(confluencePageUrl, "_blank")}
                        className="text-xs"
                        style={{ borderColor: colors.brand, color: colors.brand }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        View in Confluence
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Page title: <span className="font-mono">Test Cases - {selectedProject?.project_name || "Project"} - {scenarioPageTitle || "Feature"} - {new Date().toISOString().slice(0, 10)}</span>
                  </p>
                </div>
              )}

              {/* ── Push to GitHub Repository ── */}
              {pastedGherkin.trim() && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block">
                    Push to GitHub Repository
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">GitHub Repository URL</label>
                      <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/your-org/katalon-tests"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all"
                        style={{ color: "#1a1a1a" }}
                        onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Branch Name</label>
                      <input
                        type="text"
                        value={githubBranch}
                        onChange={(e) => setGithubBranch(e.target.value)}
                        placeholder="test/auto-generated"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all"
                        style={{ color: "#1a1a1a" }}
                        onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">GitHub Personal Access Token (repo scope)</label>
                    <div className="relative">
                      <input
                        type={showGithubToken ? "text" : "password"}
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all font-mono"
                        style={{ color: "#1a1a1a" }}
                        onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowGithubToken(!showGithubToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {featureFiles.length > 0 && (
                    <div className="text-xs text-gray-400">
                      <span className="font-medium">{featureFiles.length} .feature file{featureFiles.length !== 1 ? "s" : ""}</span> will be pushed to <span className="font-mono">tests/features/</span>:
                      <div className="mt-1 space-y-0.5">
                        {featureFiles.map((f, i) => (
                          <div key={i} className="font-mono text-[11px] text-gray-500">
                            tests/features/{f.filename}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handlePushToGitHub}
                    disabled={!isGherkinValid || !repoUrl.trim() || !githubToken.trim() || isPushingGitHub || pushedToGitHub}
                    className="text-white text-sm font-medium w-full"
                    style={pushedToGitHub ? { backgroundColor: "#16a34a" } : { backgroundColor: colors.brand }}
                  >
                    {isPushingGitHub ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pushing to GitHub...</>
                    ) : pushedToGitHub ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" />Pushed to GitHub</>
                    ) : (
                      <><GitBranch className="w-4 h-4 mr-2" />Push .feature Files to GitHub</>
                    )}
                  </Button>

                  {/* GitHub success info */}
                  {pushedToGitHub && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {githubPrUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(githubPrUrl!, "_blank")}
                            className="text-xs"
                            style={{ borderColor: colors.brand, color: colors.brand }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            View Pull Request
                          </Button>
                        )}
                        {githubBranchUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(githubBranchUrl!, "_blank")}
                            className="text-xs"
                            style={{ borderColor: "#6b7280", color: "#6b7280" }}
                          >
                            <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                            View Branch
                          </Button>
                        )}
                      </div>

                      {/* Katalon integration note */}
                      <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-green-200 bg-green-50">
                        <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Katalon Studio Integration</p>
                          <p className="text-xs text-green-600 mt-1 leading-relaxed">
                            The .feature files are Katalon-compatible (standard Cucumber Gherkin). To use them:
                          </p>
                          <ol className="text-xs text-green-600 mt-1.5 space-y-1 list-decimal list-inside">
                            <li>Pull the <span className="font-mono font-medium">{githubBranch}</span> branch in your Katalon project</li>
                            <li>The .feature files will appear under <span className="font-mono">tests/features/</span></li>
                            <li>Open Katalon Studio and import the feature files</li>
                            <li>Katalon will auto-generate Groovy step definition stubs</li>
                            <li>Implement the step definitions and run your BDD test suite</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MANUAL MODE — Stepper + Step 1 (Confluence) + Step 2 (Paste & Deliver)
             ════════════════════════════════════════════════════════════════ */}
          {mode === "manual" && (<>

            {/* Stepper */}
            <div className="flex items-center mb-6 px-2">
              <StepBadge step={1} active={!step1Done} done={step1Done} />
              <StepConnector done={step1Done} />
              <StepBadge step={2} active={step1Done && !step2Done} done={step2Done} />
            </div>

            {/* ── Step 1: Select Confluence Page & Copy Prompt ── */}
            <Card className="border-gray-200 shadow-sm mb-5">
              <div className="h-1 w-full" style={{ backgroundColor: step1Done ? "#16a34a" : colors.brand }} />
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: step1Done ? "rgba(22, 163, 74, 0.1)" : `rgba(${colors.brandRgb}, 0.08)` }}
                  >
                    <BookOpen className="w-4 h-4" style={{ color: step1Done ? "#16a34a" : colors.brand }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
                      Select Scenario Page & Copy Prompt
                    </CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Pick a Confluence page with test scenarios, then copy the AI prompt into your IDE
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Confluence page selector */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Confluence Scenario Page
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setPageDropdownOpen(!pageDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors text-left"
                      style={{ color: "#1a1a1a" }}
                    >
                      <span className={selectedPageObj ? "text-gray-900" : "text-gray-400"}>
                        {selectedPageObj ? selectedPageObj.title : "Select a Confluence page..."}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pageDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {pageDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Search pages..."
                              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {isLoadingPages ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                          ) : sortedPages.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-400 text-center">No pages found</div>
                          ) : (
                            sortedPages.map((page) => (
                              <button
                                key={page.id}
                                onClick={() => handleSelectPage(page.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 text-left transition-colors"
                              >
                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate" style={{ color: "#1a1a1a" }}>{page.title}</span>
                                {page.title.toLowerCase().includes("test scenario") && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium flex-shrink-0">
                                    Scenario
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loading indicator */}
                {isLoadingContent && (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.brand }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>Parsing scenarios...</p>
                      <p className="text-xs text-gray-400">Analysing page with AI to extract test scenarios and build your prompt</p>
                    </div>
                  </div>
                )}

                {/* Parsed scenarios list */}
                {parsedScenarios.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Detected Scenarios ({parsedScenarios.length})
                    </label>
                    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-44 overflow-y-auto">
                      {parsedScenarios.map((s) => (
                        <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.06)`, color: colors.brand }}
                          >
                            {s.id}
                          </span>
                          <span className="text-xs text-gray-700 truncate">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Prompt */}
                {dynamicPrompt && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        AI Prompt
                      </label>
                      <button
                        onClick={() => setShowFullPrompt(!showFullPrompt)}
                        className="text-xs flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showFullPrompt ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showFullPrompt ? "Collapse" : "Expand"}
                      </button>
                    </div>
                    <div
                      className={`relative rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-600 ${
                        showFullPrompt ? "" : "max-h-28 overflow-hidden"
                      }`}
                    >
                      <pre className="whitespace-pre-wrap">{dynamicPrompt}</pre>
                      {!showFullPrompt && (
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50" />
                      )}
                    </div>
                    <Button
                      onClick={handleCopyPrompt}
                      className="mt-3 text-white text-sm font-medium w-full"
                      style={{ backgroundColor: promptCopied ? "#16a34a" : colors.brand }}
                    >
                      {promptCopied ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" />Prompt Copied!</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-2" />Copy Prompt to Clipboard</>
                      )}
                    </Button>
                    <p className="text-xs text-gray-400 mt-1.5 text-center">
                      Paste this into Cursor, Claude Code, Copilot, or any AI IDE
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Step 2: Paste Gherkin & Deliver ── */}
            <Card className={`border-gray-200 shadow-sm ${!step1Done ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="h-1 w-full" style={{ backgroundColor: step2Done ? "#16a34a" : step1Done ? colors.brand : "#e5e7eb" }} />
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: step2Done ? "rgba(22, 163, 74, 0.1)" : `rgba(${colors.brandRgb}, 0.08)` }}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: step2Done ? "#16a34a" : colors.brand }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
                      Paste & Deliver Test Cases
                    </CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step2Done
                        ? "Test cases delivered successfully"
                        : "Paste the Gherkin .feature output from your IDE, then push to Confluence and GitHub"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Gherkin textarea */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Paste .feature File Output
                  </label>
                  <textarea
                    value={pastedGherkin}
                    onChange={(e) => {
                      setPastedGherkin(e.target.value);
                      setPushedToConfluence(false);
                      setPushedToGitHub(false);
                      setConfluencePageUrl(null);
                      setGithubPrUrl(null);
                      setGithubBranchUrl(null);
                    }}
                    disabled={!dynamicPrompt}
                    placeholder={`@TS-001 @regression\nFeature: Language Detection and Support\n\n  Background:\n    Given the language detection service is running\n    And the NLP models are loaded\n\n  Scenario: Successfully detect Spanish input\n    When I send a POST request to "/api/v1/detect-language" with body:\n      """\n      {"text": "Hola, necesito ayuda"}\n      """\n    Then the response status should be 200\n    And the response field "detected_language" should be "es"\n\n  Scenario: Reject unsupported language\n    When I send a POST request to "/api/v1/detect-language" with body:\n      """\n      {"text": "unsupported"}\n      """\n    Then the response status should be 422`}
                    className="w-full h-52 px-4 py-3 text-sm rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-all font-mono leading-relaxed"
                    style={{ color: "#1a1a1a" }}
                    onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                    onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Gherkin Validation */}
                {pastedGherkin.trim() && gherkinValidation.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-700">
                      <span className="font-medium">Gherkin syntax issues:</span>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        {gherkinValidation.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Valid Gherkin indicator */}
                {isGherkinValid && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50">
                    <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-green-700">Valid Gherkin syntax detected</span>
                  </div>
                )}

                {/* Coverage Matrix */}
                {coverageMatrix.length > 0 && pastedGherkin.trim() && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.04)` }}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" style={{ color: colors.brand }} />
                        <span className="text-sm font-semibold" style={{ color: colors.brand }}>Coverage Matrix</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${totalCount > 0 ? (coveredCount / totalCount) * 100 : 0}%`,
                              backgroundColor: coveredCount === totalCount ? "#16a34a" : "#f59e0b",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: coveredCount === totalCount ? "#16a34a" : "#f59e0b" }}>
                          {coveredCount}/{totalCount}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {coverageMatrix.map((item) => (
                        <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                          {item.covered ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                            style={{
                              backgroundColor: item.covered ? "rgba(22, 163, 74, 0.08)" : "rgba(0,0,0,0.04)",
                              color: item.covered ? "#16a34a" : "#9ca3af",
                            }}
                          >
                            {item.id}
                          </span>
                          <span className={`text-xs flex-1 truncate ${item.covered ? "text-gray-700" : "text-gray-400"}`}>
                            {item.name}
                          </span>
                          {item.covered && (
                            <span className="text-[10px] text-green-600 font-medium flex-shrink-0">
                              {item.testCaseCount} test case{item.testCaseCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!item.covered && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">not in code</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Push to Confluence */}
                {pastedGherkin.trim() && (
                  <div className="pt-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Save to Confluence
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handlePushToConfluence}
                        disabled={!isGherkinValid || isPushingConfluence || pushedToConfluence}
                        className="text-white text-sm font-medium"
                        style={pushedToConfluence ? { backgroundColor: "#16a34a" } : { backgroundColor: colors.brand }}
                      >
                        {isPushingConfluence ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pushing...</>
                        ) : pushedToConfluence ? (
                          <><CheckCircle2 className="w-4 h-4 mr-2" />Saved to Confluence</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-2" />Push to Confluence</>
                        )}
                      </Button>
                      {confluencePageUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(confluencePageUrl, "_blank")}
                          className="text-xs"
                          style={{ borderColor: colors.brand, color: colors.brand }}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          View in Confluence
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Page title: <span className="font-mono">Test Cases - {selectedProject?.project_name || "Project"} - {scenarioPageTitle || "Feature"} - {new Date().toISOString().slice(0, 10)}</span>
                    </p>
                  </div>
                )}

                {/* Push to GitHub */}
                {pastedGherkin.trim() && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block">
                      Push to GitHub Repository
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 mb-1 block">GitHub Repository URL</label>
                        <input
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/your-org/katalon-tests"
                          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all"
                          style={{ color: "#1a1a1a" }}
                          onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                          onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 mb-1 block">Branch Name</label>
                        <input
                          type="text"
                          value={githubBranch}
                          onChange={(e) => setGithubBranch(e.target.value)}
                          placeholder="test/auto-generated"
                          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all"
                          style={{ color: "#1a1a1a" }}
                          onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                          onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">GitHub Personal Access Token (repo scope)</label>
                      <div className="relative">
                        <input
                          type={showGithubToken ? "text" : "password"}
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border border-gray-200 focus:outline-none transition-all font-mono"
                          style={{ color: "#1a1a1a" }}
                          onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(27,60,113,0.2)"; }}
                          onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGithubToken(!showGithubToken)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {featureFiles.length > 0 && (
                      <div className="text-xs text-gray-400">
                        <span className="font-medium">{featureFiles.length} .feature file{featureFiles.length !== 1 ? "s" : ""}</span> will be pushed to <span className="font-mono">tests/features/</span>:
                        <div className="mt-1 space-y-0.5">
                          {featureFiles.map((f, i) => (
                            <div key={i} className="font-mono text-[11px] text-gray-500">
                              tests/features/{f.filename}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={handlePushToGitHub}
                      disabled={!isGherkinValid || !repoUrl.trim() || !githubToken.trim() || isPushingGitHub || pushedToGitHub}
                      className="text-white text-sm font-medium w-full"
                      style={pushedToGitHub ? { backgroundColor: "#16a34a" } : { backgroundColor: colors.brand }}
                    >
                      {isPushingGitHub ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pushing to GitHub...</>
                      ) : pushedToGitHub ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" />Pushed to GitHub</>
                      ) : (
                        <><GitBranch className="w-4 h-4 mr-2" />Push .feature Files to GitHub</>
                      )}
                    </Button>
                    {/* GitHub success info */}
                    {pushedToGitHub && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {githubPrUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(githubPrUrl!, "_blank")}
                              className="text-xs"
                              style={{ borderColor: colors.brand, color: colors.brand }}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              View Pull Request
                            </Button>
                          )}
                          {githubBranchUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(githubBranchUrl!, "_blank")}
                              className="text-xs"
                              style={{ borderColor: "#6b7280", color: "#6b7280" }}
                            >
                              <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                              View Branch
                            </Button>
                          )}
                        </div>
                        {/* Katalon integration note */}
                        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-green-200 bg-green-50">
                          <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-green-800">Katalon Studio Integration</p>
                            <p className="text-xs text-green-600 mt-1 leading-relaxed">
                              The .feature files are Katalon-compatible (standard Cucumber Gherkin). To use them:
                            </p>
                            <ol className="text-xs text-green-600 mt-1.5 space-y-1 list-decimal list-inside">
                              <li>Pull the <span className="font-mono font-medium">{githubBranch}</span> branch in your Katalon project</li>
                              <li>The .feature files will appear under <span className="font-mono">tests/features/</span></li>
                              <li>Open Katalon Studio and import the feature files</li>
                              <li>Katalon will auto-generate Groovy step definition stubs</li>
                              <li>Implement the step definitions and run your BDD test suite</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </>)}

          </>)}

        </div>
      </div>
    </MainLayout>
  );
};

export default TestingPage;
