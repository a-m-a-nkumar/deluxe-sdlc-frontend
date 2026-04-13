import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG } from "@/config/api";
import { apiPost } from "@/services/api";
import {
  Search, Loader2, GitBranch, FolderOpen, Building2, User,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock,
  Activity, Layers, ArrowLeft, Code2, Tag, Calendar, Plus,
} from "lucide-react";
import {
  getAccount, listOrganizations, listProjects, listPipelines,
  listPipelineExecutions, getPipelineDetail, getExecutionLogs,
  testAidaGenerate, parseQueryIntent, buildConfig,
  type HarnessCredentials, type HarnessProject, type HarnessPipeline,
  type HarnessPipelineExecution, type HarnessOrg, type PipelineDetail,
  type ExecutionLogs,
} from "@/services/harnessApi";

const BACKEND = API_CONFIG.BASE_URL;

interface Props {
  credentials: HarnessCredentials;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const s = status?.toUpperCase();
  const style: Record<string, string> = {
    SUCCESS: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700",
    RUNNING: "bg-blue-100 text-blue-700",  ABORTED: "bg-gray-100 text-gray-600",
    ACTIVE:  "bg-green-100 text-green-700",
  };
  const icon: Record<string, JSX.Element> = {
    SUCCESS: <CheckCircle2 className="w-3 h-3" />,
    FAILED:  <XCircle className="w-3 h-3" />,
    RUNNING: <Loader2 className="w-3 h-3 animate-spin" />,
    ACTIVE:  <CheckCircle2 className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style[s] || "bg-gray-100 text-gray-600"}`}>
      {icon[s]} {status}
    </span>
  );
};

const AccountCard = ({ data }: { data: any }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Account Info</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-2 gap-3 text-sm">
      <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{data.name}</span></div>
      <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{data.identifier}</span></div>
      <div><span className="text-muted-foreground">Plan:</span> <StatusBadge status={data.accountType} /></div>
      <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={data.accountStatus} /></div>
      <div><span className="text-muted-foreground">Company:</span> <span>{data.companyName}</span></div>
      <div><span className="text-muted-foreground">Cluster:</span> <span>{data.cluster}</span></div>
    </CardContent>
  </Card>
);

const OrgList = ({ orgs }: { orgs: HarnessOrg[] }) => (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{orgs.length} organization(s) found</p>
    {orgs.map((org) => (
      <Card key={org.identifier}>
        <CardContent className="py-3 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div>
            <div className="font-medium text-sm">{org.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{org.identifier}</div>
            {org.description && <div className="text-xs text-muted-foreground">{org.description}</div>}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ProjectList = ({ projects }: { projects: HarnessProject[] }) => (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{projects.length} project(s) found</p>
    {projects.map((p) => (
      <Card key={p.identifier}>
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{p.identifier}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.modules?.slice(0, 6).map((m) => (
                  <span key={m} className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded">{m}</span>
                ))}
                {(p.modules?.length || 0) > 6 && (
                  <span className="text-xs text-muted-foreground">+{p.modules.length - 6} more</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const PipelineList = ({ pipelines, onSelect }: { pipelines: HarnessPipeline[]; onSelect: (p: HarnessPipeline) => void }) => (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{pipelines.length} pipeline(s) found — click any to see details</p>
    {pipelines.length === 0 && (
      <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No pipelines created yet.</CardContent></Card>
    )}
    {pipelines.map((p) => (
      <Card key={p.identifier} className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => onSelect(p)}>
        <CardContent className="py-3 flex items-start gap-3">
          <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-primary">{p.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{p.identifier}</div>
            {p.executionSummaryInfo?.lastExecutionStatus && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Last run:</span>
                <StatusBadge status={p.executionSummaryInfo.lastExecutionStatus} />
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">View →</span>
        </CardContent>
      </Card>
    ))}
  </div>
);

const PipelineDetailPanel = ({ detail, onBack }: { detail: PipelineDetail; onBack: () => void }) => (
  <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="w-4 h-4" /> Back to pipelines
    </button>
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4" /> {detail.metadata.name}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{detail.metadata.identifier}</span></div>
        <div><span className="text-muted-foreground">Store:</span> <span>{detail.metadata.storeType || "INLINE"}</span></div>
        {detail.metadata.created && (
          <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Created:</span><span>{new Date(detail.metadata.created).toLocaleDateString()}</span></div>
        )}
        {detail.metadata.updated && (
          <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Updated:</span><span>{new Date(detail.metadata.updated).toLocaleDateString()}</span></div>
        )}
        {detail.metadata.description && (
          <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span>{detail.metadata.description}</span></div>
        )}
        {detail.metadata.tags && Object.keys(detail.metadata.tags).length > 0 && (
          <div className="col-span-2 flex items-center gap-2 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {Object.entries(detail.metadata.tags).map(([k, v]) => (
              <span key={k} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{k}{v ? `: ${v}` : ""}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Executions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {detail.recent_executions.length === 0 && <p className="text-sm text-muted-foreground">No executions yet</p>}
        {detail.recent_executions.map((e) => (
          <div key={e.planExecutionId} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{e.runSequence}</span>
              <StatusBadge status={e.status} />
              {e.startTs && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(e.startTs).toLocaleString()}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    {detail.yaml && (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" /> Pipeline YAML</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre">{detail.yaml}</pre>
        </CardContent>
      </Card>
    )}
  </div>
);

const ExecutionList = ({ executions, onViewLogs }: { executions: HarnessPipelineExecution[]; onViewLogs: (e: HarnessPipelineExecution) => void }) => (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{executions.length} execution(s) found — click any to view logs</p>
    {executions.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No executions found.</CardContent></Card>}
    {executions.map((e) => (
      <Card key={e.planExecutionId} className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => onViewLogs(e)}>
        <CardContent className="py-3 flex items-start gap-3">
          <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{e.name || e.pipelineIdentifier}</span>
              <span className="text-xs text-muted-foreground">#{e.runSequence}</span>
              <StatusBadge status={e.status} />
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">{e.planExecutionId}</div>
            {e.startTs && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{new Date(e.startTs).toLocaleString()}</div>}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">View logs →</span>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ExecutionLogPanel = ({ logs, onBack }: { logs: ExecutionLogs; onBack: () => void }) => (
  <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="w-4 h-4" /> Back to executions
    </button>
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Execution Summary</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Pipeline:</span> <span className="font-medium">{logs.pipelineName}</span></div>
        <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={logs.status} /></div>
        {logs.triggeredBy && <div><span className="text-muted-foreground">Triggered by:</span> <span>{logs.triggeredBy}</span></div>}
        {logs.triggerType && <div><span className="text-muted-foreground">Trigger type:</span> <span>{logs.triggerType}</span></div>}
        {logs.startTs && <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Start:</span><span>{new Date(logs.startTs).toLocaleString()}</span></div>}
        {logs.endTs && <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">End:</span><span>{new Date(logs.endTs).toLocaleString()}</span></div>}
        {logs.errorMessage && (
          <div className="col-span-2 bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
            <span className="font-medium">Error:</span> {logs.errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
    {logs.stages.length > 0 && (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Stages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.stages.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{s.identifier}</span>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    )}
    {logs.failed_nodes.length > 0 && (
      <Card className="border-red-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4" /> Failed Steps ({logs.failed_nodes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {logs.failed_nodes.map((node, i) => (
            <div key={i} className="bg-red-50 border border-red-100 rounded p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-red-700">{node.name}</span>
                {node.type && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{node.type}</span>}
                <StatusBadge status={node.status} />
              </div>
              {node.errorMessage && <p className="text-xs text-red-600 font-mono bg-red-100 rounded p-2 mt-1">{node.errorMessage}</p>}
              {node.failureType && node.failureType.length > 0 && <p className="text-xs text-muted-foreground">Failure type: {node.failureType.join(", ")}</p>}
              {node.startTs && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(node.startTs).toLocaleString()}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    )}
  </div>
);

const SUGGESTIONS = [
  "show account info", "list organizations", "list all projects",
  "show pipelines", "show pipeline executions",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExplorerSection({ credentials }: Props) {
  const { toast } = useToast();
  const config = buildConfig(credentials.apiKey);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultType, setResultType] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);

  const [pipelineDetail, setPipelineDetail] = useState<PipelineDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogs | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [showAida, setShowAida] = useState(false);
  const [aidaPrompt, setAidaPrompt] = useState("Kubernetes rolling deployment for a Node.js React frontend app");
  const [aidaLoading, setAidaLoading] = useState(false);
  const [aidaResult, setAidaResult] = useState<any>(null);

  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("main");
  const [newRepoPublic, setNewRepoPublic] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [createRepoResult, setCreateRepoResult] = useState<{ url: string; name: string } | null>(null);

  const handleViewLogs = async (e: HarnessPipelineExecution & { _orgId?: string; _projectId?: string }) => {
    setExecutionLogs(null);
    setLoadingLogs(true);
    try {
      const logs = await getExecutionLogs(config, e._orgId || credentials.orgId, e._projectId || credentials.projectId, e.planExecutionId);
      setExecutionLogs(logs);
    } catch (err: any) {
      toast({ title: "Failed to load execution logs", description: err.message, variant: "destructive" });
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSelectPipeline = async (p: HarnessPipeline & { _orgId?: string; _projectId?: string }) => {
    setPipelineDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await getPipelineDetail(config, p._orgId || credentials.orgId, p._projectId || credentials.projectId, p.identifier);
      setPipelineDetail(detail);
    } catch (err: any) {
      toast({ title: "Failed to load pipeline details", description: err.message, variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAidaTest = async () => {
    setAidaLoading(true);
    setAidaResult(null);
    try {
      const result = await testAidaGenerate(config, credentials.orgId, credentials.projectId, aidaPrompt);
      setAidaResult(result);
    } catch (err: any) {
      setAidaResult({ error: err.message });
    } finally {
      setAidaLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) {
      toast({ title: "Repository name required", variant: "destructive" });
      return;
    }
    setCreatingRepo(true);
    setCreateRepoResult(null);
    try {
      const res = await apiPost(`${BACKEND}/api/harness/create-repo`, {
        api_key: credentials.apiKey,
        account_id: credentials.accountId,
        org_id: credentials.orgId,
        project_id: credentials.projectId || undefined,
        repo_name: newRepoName.trim(),
        description: newRepoDesc.trim(),
        default_branch: newRepoBranch || "main",
        is_public: newRepoPublic,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create repository");
      setCreateRepoResult({ url: data.repo_url, name: data.repo_name });
      toast({ title: `Repository "${data.repo_name}" created!` });
      setNewRepoName("");
      setNewRepoDesc("");
    } catch (err: any) {
      toast({ title: "Failed to create repository", description: err.message, variant: "destructive" });
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setResultData(null);
    setResultType(null);
    try {
      const intent = parseQueryIntent(q);
      if (intent === "account") {
        setResultType("account");
        setResultData(await getAccount(config));
      } else if (intent === "organizations") {
        setResultType("organizations");
        setResultData(await listOrganizations(config));
      } else if (intent === "projects") {
        setResultType("projects");
        setResultData(await listProjects(config, credentials.orgId));
      } else if (intent === "pipelines") {
        const projects = await listProjects(config);
        const all: any[] = [];
        for (const p of projects) {
          const pipes = await listPipelines(config, p.orgIdentifier || credentials.orgId, p.identifier);
          pipes.forEach(pipe => all.push({ ...pipe, _orgId: p.orgIdentifier, _projectId: p.identifier }));
        }
        setPipelineDetail(null);
        setResultType("pipelines");
        setResultData(all);
      } else if (intent === "executions") {
        const projects = await listProjects(config);
        const resolved = credentials.projectId
          ? projects.find(p => p.identifier === credentials.projectId) || projects[0]
          : projects[0];
        if (!resolved) {
          toast({ title: "No projects found", variant: "destructive" });
          return;
        }
        const execs = await listPipelineExecutions(config, resolved.orgIdentifier || credentials.orgId, resolved.identifier);
        setExecutionLogs(null);
        setResultType("executions");
        setResultData(execs.map(e => ({ ...e, _orgId: resolved.orgIdentifier, _projectId: resolved.identifier })));
      } else {
        setResultType("projects");
        setResultData(await listProjects(config, credentials.orgId));
      }
    } catch (err: any) {
      toast({ title: "Query failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold">Explorer</h2>
            <p className="text-sm text-muted-foreground">Query your Harness account — pipelines, projects, executions and more.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowCreateRepo(!showCreateRepo); setCreateRepoResult(null); }} className="flex items-center gap-1 text-muted-foreground">
              <Plus className="w-4 h-4" /> Create Repo
              {showCreateRepo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAida(!showAida); setAidaResult(null); }} className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-4 h-4" /> Test AIDA
              {showAida ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Create Repo Panel */}
      {showCreateRepo && (
        <div className="px-6 py-4 flex-shrink-0 border-b border-border">
          <Card className="border-green-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-green-700"><GitBranch className="w-4 h-4" /> Create Harness Code Repository</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Creates a new repo in Harness Code using your saved credentials.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Repository Name *</label>
                  <Input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="my-repo" className="text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Default Branch</label>
                  <Input value={newRepoBranch} onChange={(e) => setNewRepoBranch(e.target.value)} placeholder="main" className="text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                  <Input value={newRepoDesc} onChange={(e) => setNewRepoDesc(e.target.value)} placeholder="Repository description" className="text-sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Org: <span className="font-mono font-medium">{credentials.orgId}</span>{credentials.projectId && <> · Project: <span className="font-mono font-medium">{credentials.projectId}</span></>}</p>
              <div className="flex items-center justify-between">
                <button onClick={() => setNewRepoPublic((v) => !v)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <span className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${newRepoPublic ? "bg-primary" : "bg-muted-foreground/30"}`}>
                    <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${newRepoPublic ? "translate-x-4" : "translate-x-0"}`} />
                  </span>
                  {newRepoPublic ? "Public repository" : "Private repository"}
                </button>
                <Button size="sm" onClick={handleCreateRepo} disabled={creatingRepo || !newRepoName.trim()}>
                  {creatingRepo ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Creating...</> : <><Plus className="w-3 h-3 mr-1" /> Create Repository</>}
                </Button>
              </div>
              {createRepoResult && (
                <div className="bg-green-50 border border-green-200 rounded p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Repository "{createRepoResult.name}" created!</p>
                    <a href={createRepoResult.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                      <GitBranch className="w-3 h-3" /> Open in Harness Code
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AIDA Panel */}
      {showAida && (
        <div className="px-6 py-4 flex-shrink-0 border-b border-border">
          <Card className="border-blue-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-blue-700"><Activity className="w-4 h-4" /> Test Harness AIDA — Pipeline Generation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Send a natural language prompt to Harness AIDA to check if the pipeline generation endpoint is accessible.</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prompt</label>
                <Input value={aidaPrompt} onChange={(e) => setAidaPrompt(e.target.value)} placeholder="e.g. Kubernetes rolling deployment for Node.js app" className="text-sm" />
              </div>
              <div className="flex flex-wrap gap-2">
                {["Kubernetes rolling deployment for Node.js", "Blue-green deployment for React frontend", "Canary deployment for Java microservice"].map(s => (
                  <button key={s} onClick={() => setAidaPrompt(s)} className="text-xs px-2 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">{s}</button>
                ))}
              </div>
              <Button size="sm" onClick={handleAidaTest} disabled={aidaLoading || !aidaPrompt.trim()}>
                {aidaLoading ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Testing...</> : "Test AIDA Endpoint"}
              </Button>
              {aidaResult && (
                <div className="mt-2 space-y-2">
                  {aidaResult.error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{aidaResult.error}</p>}
                  {aidaResult.probed && aidaResult.probed.map((r: any, i: number) => {
                    const is200 = r.status_code === 200 || r.status_code === 201;
                    const badge = is200 ? "bg-green-100 text-green-700" : r.error ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700";
                    return (
                      <div key={i} className="border rounded p-2 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{r.method}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{r.error ? "Error" : `HTTP ${r.status_code}`}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-xs">{r.url?.replace("https://app.harness.io", "")}</span>
                        </div>
                        <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
                          {r.error ? r.error : JSON.stringify(r.response, null, 2)}
                        </pre>
                        {is200 && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> AIDA is accessible!</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-6 py-4 flex-shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 text-sm"
              placeholder="e.g. show all pipelines, list projects, show executions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Fetching..." : "Search"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => { setQuery(s); handleSearch(s); }}
              className="text-xs px-3 py-1 rounded-full border border-border hover:bg-accent transition-colors text-muted-foreground">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {!resultData && !loading && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Type a query or click a suggestion above</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Fetching from Harness...</span>
          </div>
        )}
        {(loadingDetail || loadingLogs) && (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{loadingLogs ? "Loading execution logs..." : "Loading pipeline details..."}</span>
          </div>
        )}
        {!loading && !loadingDetail && !loadingLogs && pipelineDetail && (
          <PipelineDetailPanel detail={pipelineDetail} onBack={() => setPipelineDetail(null)} />
        )}
        {!loading && !loadingDetail && !loadingLogs && executionLogs && (
          <ExecutionLogPanel logs={executionLogs} onBack={() => setExecutionLogs(null)} />
        )}
        {!loading && !loadingDetail && !loadingLogs && !pipelineDetail && !executionLogs && resultData && (
          <div className="space-y-3">
            {resultType === "account"       && <AccountCard data={resultData} />}
            {resultType === "organizations" && <OrgList orgs={resultData} />}
            {resultType === "projects"      && <ProjectList projects={resultData} />}
            {resultType === "pipelines"     && <PipelineList pipelines={resultData} onSelect={handleSelectPipeline} />}
            {resultType === "executions"    && <ExecutionList executions={resultData} onViewLogs={handleViewLogs} />}
          </div>
        )}
      </div>
    </div>
  );
}
