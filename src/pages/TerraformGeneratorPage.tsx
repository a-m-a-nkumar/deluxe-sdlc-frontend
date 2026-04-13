import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG } from "@/config/api";
import { apiPost } from "@/services/api";
import { getAccessToken } from "@/services/authService";
import {
  ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  Download, Copy, RefreshCw, FileCode2, FolderTree,
  Database, Cloud, Shield, Layers, Server, Package,
  GitBranch, ExternalLink, Lock, Unlock, FileUp,
} from "lucide-react";

const BACKEND = API_CONFIG.BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Component {
  id: string;
  name: string;
  description: string;
  category: string;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = ["Upload SAD", "Components", "Generate", "Download"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${i + 1 === step ? "text-primary font-semibold" : i + 1 < step ? "text-green-600" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
              ${i + 1 === step ? "border-primary bg-primary text-white" : i + 1 < step ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/40"}`}>
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span className="text-sm hidden sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
        </div>
      ))}
    </div>
  );
}

// ─── Category icon map ────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string }) {
  const map: Record<string, React.ReactNode> = {
    networking: <Cloud className="w-4 h-4 text-blue-500" />,
    compute:    <Server className="w-4 h-4 text-purple-500" />,
    storage:    <Package className="w-4 h-4 text-orange-500" />,
    database:   <Database className="w-4 h-4 text-green-500" />,
    security:   <Shield className="w-4 h-4 text-red-500" />,
    integration:<Layers className="w-4 h-4 text-cyan-500" />,
    monitoring: <FileCode2 className="w-4 h-4 text-yellow-500" />,
  };
  return <>{map[category] ?? <FileCode2 className="w-4 h-4 text-muted-foreground" />}</>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TerraformGeneratorCore() {
  const { toast } = useToast();

  // Step 1
  const [docText, setDocText]       = useState("");
  const [docTitle, setDocTitle]     = useState("Solution Architecture Document");
  const [projectName, setProjectName] = useState("my-infrastructure");
  const [awsRegion, setAwsRegion]     = useState("us-east-1");
  const [environment, setEnvironment] = useState("dev");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string>("");
  const [uploadedText, setUploadedText] = useState<string>("");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [components, setComponents]   = useState<Component[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", description: "", category: "compute", id: "" });
  const [compValidating, setCompValidating] = useState(false);
  const [compNameError, setCompNameError] = useState("");

  // Step 3
  const [files, setFiles]           = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress]   = useState<string[]>([]);
  const [activeFile, setActiveFile]     = useState<string>("");

  // Step 4
  const [isDownloading, setIsDownloading] = useState(false);

  // Push panel
  const [showPushPanel, setShowPushPanel] = useState(false);
  const [pushTarget, setPushTarget]       = useState<"github" | "harness">("github");
  const [isPushing, setIsPushing]         = useState(false);
  const [pushResult, setPushResult]       = useState<{ repo_url: string; commit_sha: string; files_pushed: number } | null>(null);

  // GitHub push fields
  const [ghToken, setGhToken]           = useState("");
  const [ghRepo, setGhRepo]             = useState("");
  const [ghBranch, setGhBranch]         = useState("main");
  const [ghFolder, setGhFolder]         = useState("");
  const [ghPrivate, setGhPrivate]       = useState(true);
  const [ghCommitMsg, setGhCommitMsg]   = useState("feat: add Terraform infrastructure code");

  // Harness Code push fields
  const [harnessApiKey, setHarnessApiKey]     = useState("");
  const [harnessRepoUrl, setHarnessRepoUrl]   = useState("");
  const [harnessBranch, setHarnessBranch]     = useState("main");
  const [harnessFolder, setHarnessFolder]     = useState("");
  const [harnessCommitMsg, setHarnessCommitMsg] = useState("feat: add Terraform infrastructure code");


  const [step, setStep] = useState(1);

  // ── Step 1 → 2: Extract components ────────────────────────────────────────

  const handleExtract = async () => {
    const activeText = inputMode === "upload" ? uploadedText : docText;
    if (!activeText.trim()) {
      toast({
        title: "Document required",
        description: inputMode === "upload" ? "Please upload a document first." : "Paste your SAD document content first.",
        variant: "destructive"
      });
      return;
    }
    setIsExtracting(true);
    try {
      const res = await apiPost(`${BACKEND}/api/terraform/extract-components`, {
        document_content: activeText,
        document_title: docTitle,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Extraction failed");
      }
      const data = await res.json();
      const comps: Component[] = data.components || [];
      setComponents(comps);
      setSelected(new Set(comps.map((c) => c.id)));
      setStep(2);
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !["pdf", "docx", "txt", "md"].includes(ext || "")) {
      toast({ title: "Unsupported file", description: "Please upload a PDF, DOCX, or TXT file.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiPost(`${BACKEND}/api/terraform/parse-document`, formData);

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setUploadedText(data.text);
      setUploadedFile(file.name);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setDocTitle(nameWithoutExt);
      toast({ title: "Document ready", description: `Extracted ${data.chars.toLocaleString()} characters from ${file.name}. Click Extract Components to continue.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleComponent = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleValidateCompName = async (name: string) => {
    if (!name.trim()) { setCompNameError(""); return; }
    setCompValidating(true);
    setCompNameError("");
    try {
      const res = await apiPost(`${BACKEND}/api/terraform/validate-component`, { name: name.trim() });
      const data = await res.json();
      if (!data.valid) setCompNameError(data.reason || `"${name}" is not a recognized AWS resource`);
    } catch {
      // silent fail — don't block user on network error
    } finally {
      setCompValidating(false);
    }
  };

  const handleAddComponent = () => {
    if (!newComp.name.trim()) return;
    if (compNameError) return;
    const id = newComp.id.trim() ||
      newComp.name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
    if (components.find((c) => c.id === id)) {
      toast({ title: "Duplicate", description: `A component with id "${id}" already exists.`, variant: "destructive" });
      return;
    }
    const comp: Component = { id, name: newComp.name.trim(), description: newComp.description.trim(), category: newComp.category };
    setComponents((prev) => [...prev, comp]);
    setSelected((prev) => new Set([...prev, id]));
    setNewComp({ name: "", description: "", category: "compute", id: "" });
    setShowAddForm(false);
    toast({ title: "Component added", description: `"${comp.name}" added and selected.` });
  };

  // ── Step 2 → 3: Generate Terraform ────────────────────────────────────────

  const handleGenerate = async () => {
    const chosenComponents = components.filter((c) => selected.has(c.id));
    if (chosenComponents.length === 0) {
      toast({ title: "No components selected", description: "Select at least one component.", variant: "destructive" });
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast({ title: "Session expired", description: "Please refresh and log in again.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGenProgress([]);
    setFiles({});
    setStep(3);

    try {
      const res = await fetch(`${BACKEND}/api/terraform/generate-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          document_content: docText,
          selected_components: chosenComponents,
          project_name: projectName,
          aws_region: awsRegion,
          environment,
        }),
      });

      if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "module_done") {
              setGenProgress((p) => [...p, `✓ Generated module: ${msg.name}`]);
            } else if (msg.type === "error") {
              setGenProgress((p) => [...p, `✗ Error in ${msg.module}: ${msg.message}`]);
            } else if (msg.type === "files") {
              setFiles(msg.files);
              const firstFile = Object.keys(msg.files)[0];
              setActiveFile(firstFile || "");
            } else if (msg.type === "done") {
              setGenProgress((p) => [...p, "✓ All modules complete!"]);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Push to repository (GitHub or Harness Code) ────────────────────────────

  const handlePush = async () => {
    if (Object.keys(files).length === 0) {
      toast({ title: "No files to push", description: "Generate Terraform code first.", variant: "destructive" });
      return;
    }

    if (pushTarget === "github") {
      if (!ghToken.trim()) {
        toast({ title: "GitHub token required", description: "Enter a GitHub Personal Access Token with repo scope.", variant: "destructive" });
        return;
      }
      if (!ghRepo.trim()) {
        toast({ title: "Repository name required", description: "Enter a repository name to push to.", variant: "destructive" });
        return;
      }
    } else {
      if (!harnessApiKey.trim() || !harnessRepoUrl.trim()) {
        toast({ title: "Fields required", description: "Enter your Harness API key and repo URL.", variant: "destructive" });
        return;
      }
    }

    const azureToken = await getAccessToken();
    if (!azureToken) {
      toast({ title: "Session expired", description: "Please refresh the page and log in again.", variant: "destructive" });
      return;
    }

    setIsPushing(true);
    setPushResult(null);
    try {
      let res: Response;
      if (pushTarget === "github") {
        res = await apiPost(`${BACKEND}/api/terraform/push-github`, {
          files,
          github_token: ghToken,
          repo_name: ghRepo,
          branch: ghBranch || "main",
          commit_message: ghCommitMsg,
          private: ghPrivate,
          folder_prefix: ghFolder,
        });
      } else {
        res = await apiPost(`${BACKEND}/api/terraform/push-harness`, {
          files,
          api_key: harnessApiKey,
          repo_url: harnessRepoUrl,
          branch: harnessBranch || "main",
          commit_message: harnessCommitMsg,
          folder_prefix: harnessFolder,
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Push failed");

      setPushResult({ repo_url: data.repo_url, commit_sha: data.commit_sha, files_pushed: data.files_pushed });
      const target = pushTarget === "github" ? "GitHub" : "Harness Code";
      toast({ title: `Pushed to ${target}!`, description: `${data.files_pushed} files pushed — commit ${data.commit_sha}` });
    } catch (err: any) {
      const target = pushTarget === "github" ? "GitHub" : "Harness Code";
      toast({ title: `${target} push failed`, description: err.message, variant: "destructive" });
    } finally {
      setIsPushing(false);
    }
  };

  // ── Download ZIP ───────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (Object.keys(files).length === 0) return;
    setIsDownloading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired");

      const res = await fetch(`${BACKEND}/api/terraform/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ files, project_name: projectName }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, "-")}-terraform.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyFile = () => {
    if (activeFile && files[activeFile]) {
      navigator.clipboard.writeText(files[activeFile]);
      toast({ title: "Copied to clipboard" });
    }
  };

  // ── File tree grouping ─────────────────────────────────────────────────────

  const fileTree = Object.keys(files).reduce<Record<string, string[]>>((acc, f) => {
    const parts = f.split("/");
    const group = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
    if (!acc[group]) acc[group] = [];
    acc[group].push(f);
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileCode2 className="w-6 h-6 text-primary" />
            Terraform Generator
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload your SAD → extract components → generate modular Terraform code
          </p>
        </div>

        <StepIndicator step={step} />

        {/* ── Step 1: Upload SAD ─────────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Upload Solution Architecture Document</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Document Title</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Solution Architecture Document"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Project Name</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-infrastructure"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">AWS Region</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                  >
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                    <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Environment</label>
                <div className="flex gap-2">
                  {["dev", "staging", "prod"].map((e) => (
                    <button
                      key={e}
                      onClick={() => setEnvironment(e)}
                      className={`px-4 py-1.5 rounded text-sm border font-medium transition-colors ${
                        environment === e
                          ? "bg-primary text-white border-primary"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {e.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload or Paste toggle */}
              <div>
                <div className="flex border rounded-lg overflow-hidden mb-4 w-fit">
                  <button
                    onClick={() => setInputMode("upload")}
                    className={`px-4 py-1.5 text-sm transition-colors ${inputMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Upload Document
                  </button>
                  <button
                    onClick={() => setInputMode("paste")}
                    className={`px-4 py-1.5 text-sm transition-colors ${inputMode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    Paste Text
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {inputMode === "upload" ? (
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                      ${isUploading ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 hover:bg-muted/30"}
                      ${uploadedFile ? "border-green-400 bg-green-50/50 dark:bg-green-950/20" : "border-muted-foreground/30"}`}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Parsing document...</span>
                      </div>
                    ) : uploadedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <span className="text-sm font-medium">{uploadedFile}</span>
                        <span className="text-xs text-muted-foreground">Click to replace</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FileUp className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-sm font-medium">Click to upload PDF, DOCX, or TXT</span>
                        <span className="text-xs text-muted-foreground">Only text is extracted — diagrams are ignored</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm bg-background font-mono resize-none"
                    rows={12}
                    value={docText}
                    onChange={(e) => setDocText(e.target.value)}
                    placeholder="Paste your Solution Architecture Document here..."
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleExtract} disabled={isExtracting || (inputMode === "upload" ? !uploadedFile : !docText.trim())}>
                  {isExtracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                  {isExtracting ? "Extracting components..." : "Extract Components"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Select Components ──────────────────────────────────── */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Select Infrastructure Components</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set(components.map((c) => c.id)))}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Claude identified <strong>{components.length}</strong> infrastructure components. Deselect any you don't need, or add missing ones below.
              </p>

              {/* Group by category */}
              {(["networking", "compute", "database", "storage", "security", "integration", "monitoring"] as const).map((cat) => {
                const catComps = components.filter((c) => c.category === cat);
                if (catComps.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 mt-4">
                      <CategoryIcon category={cat} />
                      {cat}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catComps.map((comp) => (
                        <div
                          key={comp.id}
                          onClick={() => toggleComponent(comp.id)}
                          className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                            selected.has(comp.id)
                              ? "border-primary bg-primary/5"
                              : "border-muted-foreground/20 hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className={`w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                            selected.has(comp.id) ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}>
                            {selected.has(comp.id) && <span className="text-white text-xs">✓</span>}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{comp.name}</div>
                            <div className="text-xs text-muted-foreground">{comp.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* ── Add custom component ─────────────────────────────── */}
              <div className="border-t pt-4">
                {!showAddForm ? (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <span className="text-lg font-bold leading-none">+</span> Add a component not detected by Claude
                  </button>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="font-medium text-sm">Add Custom Component</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Component Name *</label>
                        <input
                          placeholder="e.g. ElastiCache, WAF, Route53"
                          value={newComp.name}
                          onChange={(e) => { setNewComp((p) => ({ ...p, name: e.target.value })); setCompNameError(""); }}
                          onBlur={(e) => handleValidateCompName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddComponent()}
                          autoFocus
                          className={`w-full border rounded px-3 py-2 text-sm bg-background ${compNameError ? "border-red-500 focus:ring-red-400 focus:outline-none focus:ring-2" : ""}`}
                        />
                        {compValidating && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="animate-spin inline-block w-3 h-3 border border-muted-foreground border-t-transparent rounded-full" />
                            Validating...
                          </p>
                        )}
                        {compNameError && !compValidating && (
                          <p className="text-xs text-red-500 mt-1">⚠ {compNameError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                        <select
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={newComp.category}
                          onChange={(e) => setNewComp((p) => ({ ...p, category: e.target.value }))}
                        >
                          <option value="networking">Networking</option>
                          <option value="compute">Compute</option>
                          <option value="database">Database</option>
                          <option value="storage">Storage</option>
                          <option value="security">Security</option>
                          <option value="integration">Integration</option>
                          <option value="monitoring">Monitoring</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          placeholder="Brief description of this component's role"
                          value={newComp.description}
                          onChange={(e) => setNewComp((p) => ({ ...p, description: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleAddComponent()}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewComp({ name: "", description: "", category: "compute", id: "" }); setCompNameError(""); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleAddComponent} disabled={!newComp.name.trim() || !!compNameError || compValidating}>
                        Add Component
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={selected.size === 0}
                >
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Generate Terraform ({selected.size} modules)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: View Generated Code ────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Progress */}
            {(isGenerating || genProgress.length > 0) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {isGenerating ? "Generating Terraform modules..." : "Generation complete"}
                  </div>
                  <div className="space-y-1">
                    {genProgress.map((msg, i) => (
                      <div key={i} className="text-xs text-muted-foreground">{msg}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Code Viewer */}
            {Object.keys(files).length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="flex">
                    {/* File tree sidebar */}
                    <div className="w-56 flex-shrink-0 border-r bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <FolderTree className="w-3 h-3" /> Files
                      </div>
                      {Object.entries(fileTree).map(([group, groupFiles]) => (
                        <div key={group}>
                          <div className="text-xs text-muted-foreground font-medium mb-1">
                            {group === "root" ? "/" : group + "/"}
                          </div>
                          {groupFiles.map((f) => (
                            <button
                              key={f}
                              onClick={() => setActiveFile(f)}
                              className={`block w-full text-left text-xs px-2 py-1 rounded truncate ${
                                activeFile === f ? "bg-primary text-white" : "hover:bg-accent"
                              }`}
                              title={f}
                            >
                              {f.split("/").pop()}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Code content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                        <span className="text-xs font-mono text-muted-foreground">{activeFile}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={handleCopyFile}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                      </div>
                      <pre className="p-4 text-xs font-mono overflow-auto" style={{ maxHeight: "500px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {files[activeFile] || ""}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Regenerate
                </Button>
                <Button variant="outline"
                  onClick={() => setShowPushPanel((v) => !v)}
                  disabled={isGenerating || Object.keys(files).length === 0}
                >
                  <GitBranch className="w-4 h-4 mr-1" /> Push to Repository
                </Button>
                <Button
                  onClick={() => { handleDownload(); setStep(4); }}
                  disabled={isGenerating || Object.keys(files).length === 0}
                >
                  <Download className="w-4 h-4 mr-1" /> Download ZIP
                </Button>
              </div>
            </div>

            {/* ── Push to Repo Panel ───────────────────────────────────── */}
            {showPushPanel && (
              <Card className="border-2 border-dashed border-muted-foreground/30">
                <CardContent className="p-5 space-y-4">
                  {/* Target toggle */}
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold text-sm mr-2">Push to:</span>
                    <div className="flex rounded-md border overflow-hidden text-sm">
                      <button
                        onClick={() => setPushTarget("github")}
                        className={`px-4 py-1.5 transition-colors ${pushTarget === "github" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        GitHub
                      </button>
                      <button
                        onClick={() => setPushTarget("harness")}
                        className={`px-4 py-1.5 transition-colors ${pushTarget === "harness" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        Harness Code
                      </button>
                    </div>
                  </div>

                  {/* ── GitHub fields ── */}
                  {pushTarget === "github" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">GitHub Personal Access Token *</label>
                        <input
                          type="password"
                          className="w-full border rounded px-3 py-2 text-sm bg-background font-mono"
                          value={ghToken}
                          onChange={(e) => setGhToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Needs <code>repo</code> scope</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Repository Name *</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={ghRepo}
                          onChange={(e) => setGhRepo(e.target.value)}
                          placeholder="my-infra-terraform"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Created automatically if not existing</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Branch</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={ghBranch}
                          onChange={(e) => setGhBranch(e.target.value)}
                          placeholder="main"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Subfolder (optional)</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={ghFolder}
                          onChange={(e) => setGhFolder(e.target.value)}
                          placeholder="e.g. terraform/  (leave empty for root)"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">Commit Message</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={ghCommitMsg}
                          onChange={(e) => setGhCommitMsg(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          onClick={() => setGhPrivate((v) => !v)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {ghPrivate
                            ? <><Lock className="w-4 h-4" /> Private repository</>
                            : <><Unlock className="w-4 h-4" /> Public repository</>
                          }
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Harness Code fields ── */}
                  {pushTarget === "harness" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Harness API Key *</label>
                        <input
                          type="password"
                          className="w-full border rounded px-3 py-2 text-sm bg-background font-mono"
                          value={harnessApiKey}
                          onChange={(e) => setHarnessApiKey(e.target.value)}
                          placeholder="pat.xxxxxxxxxxxxxxxxxxxx"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Harness Personal Access Token with Code repo write permission</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Repository URL *</label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm bg-background font-mono"
                          value={harnessRepoUrl}
                          onChange={(e) => setHarnessRepoUrl(e.target.value)}
                          placeholder="https://app.harness.io/ng/account/.../module/code/orgs/.../projects/.../repos/..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">Paste the URL from your browser. If the repo doesn't exist it will be created automatically using your API key.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Branch</label>
                          <input
                            className="w-full border rounded px-3 py-2 text-sm bg-background"
                            value={harnessBranch}
                            onChange={(e) => setHarnessBranch(e.target.value)}
                            placeholder="main"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Subfolder (optional)</label>
                          <input
                            className="w-full border rounded px-3 py-2 text-sm bg-background"
                            value={harnessFolder}
                            onChange={(e) => setHarnessFolder(e.target.value)}
                            placeholder="e.g. terraform/  (leave empty for root)"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-muted-foreground mb-1 block">Commit Message</label>
                          <input
                            className="w-full border rounded px-3 py-2 text-sm bg-background"
                            value={harnessCommitMsg}
                            onChange={(e) => setHarnessCommitMsg(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handlePush}
                      disabled={isPushing || (pushTarget === "github" ? (!ghToken || !ghRepo) : (!harnessApiKey || !harnessRepoUrl))}
                    >
                      {isPushing
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pushing...</>
                        : <><GitBranch className="w-4 h-4 mr-2" /> Push {Object.keys(files).length} files</>
                      }
                    </Button>
                  </div>

                  {/* Result */}
                  {pushResult && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-3 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-green-800 dark:text-green-300">
                          Pushed {pushResult.files_pushed} files — commit <code>{pushResult.commit_sha}</code>
                        </div>
                        <a
                          href={pushResult.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary flex items-center gap-1 mt-1 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> {pushResult.repo_url}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Step 4: Done ───────────────────────────────────────────────── */}
        {step === 4 && (
          <Card>
            <CardContent className="p-10 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Terraform Code Ready!</h2>
              <p className="text-muted-foreground text-sm">
                Your modular Terraform code for <strong>{projectName}</strong> has been downloaded.
              </p>
              <div className="bg-muted rounded p-4 text-left text-sm font-mono space-y-1">
                <div className="text-muted-foreground">Next steps:</div>
                <div>$ unzip {projectName}-terraform.zip</div>
                <div>$ cd {projectName}</div>
                <div>$ cp terraform.tfvars.example terraform.tfvars</div>
                <div>$ terraform init</div>
                <div>$ terraform plan</div>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => { setStep(3); }}>
                  View Code
                </Button>
                <Button variant="outline" onClick={() => { setStep(3); setShowPushPanel(true); }}>
                  <GitBranch className="w-4 h-4 mr-1" /> Push to Repository
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                  <Download className="w-4 h-4 mr-1" />
                  {isDownloading ? "Downloading..." : "Download Again"}
                </Button>
                <Button onClick={() => { setStep(1); setDocText(""); setComponents([]); setFiles({}); setGenProgress([]); setPushResult(null); }}>
                  New Document
                </Button>
              </div>

              {pushResult && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-3 flex items-start gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">
                      Pushed — commit <code>{pushResult.commit_sha}</code>
                    </div>
                    <a href={pushResult.repo_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 mt-1 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {pushResult.repo_url}
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function TerraformGeneratorPage() {
  return (
    <MainLayout currentView="terraform-generator">
      <TerraformGeneratorCore />
    </MainLayout>
  );
}
