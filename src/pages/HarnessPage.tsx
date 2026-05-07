import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Settings,
  LayoutDashboard,
  GitBranch,
  Rocket,
  FileText,
  FileCode2,
  ArrowLeft,
  ArrowRight,
  Workflow,
  Wrench,
  MessageSquareWarning,
  Scale,
  Search,
  MousePointerClick,
  BookOpen,
  CheckCircle2,
  Bug,
  Cpu,
  Code2,
} from "lucide-react";
import SettingsSection from "@/components/harness/SettingsSection";
import OverviewSection from "@/components/harness/OverviewSection";
import PipelinesSection from "@/components/harness/PipelinesSection";
import DeploymentsSection from "@/components/harness/DeploymentsSection";
import LogsSection from "@/components/harness/LogsSection";
import { TerraformGeneratorCore } from "@/pages/TerraformGeneratorPage";
import ChatWidget from "@/components/harness/ChatWidget";
import { extractAccountId, type HarnessCredentials } from "@/services/harnessApi";

type Section = "settings" | "overview" | "pipelines" | "deployments" | "logs" | "terraform";
type DeploymentView = "home" | "devops" | "troubleshooting";

const STORAGE_KEY = "harness_credentials_v1";

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pipelines", label: "Pipelines", icon: GitBranch },
  { id: "deployments", label: "Deployments", icon: Rocket },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "terraform", label: "Terraform", icon: FileCode2 },
];

const emptyCredentials: HarnessCredentials = {
  apiKey: "",
  accountId: "",
  orgId: "",
  projectId: "",
};

export default function HarnessPage() {
  const [view, setView] = useState<DeploymentView>("home");
  const [activeSection, setActiveSection] = useState<Section>("settings");
  const [navParams, setNavParams] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<HarnessCredentials>(emptyCredentials);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: HarnessCredentials = JSON.parse(saved);
        if (parsed.apiKey) {
          setCredentials(parsed);
          setActiveSection("overview");
        }
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  const handleSaveCredentials = (creds: HarnessCredentials) => {
    const withId = { ...creds, accountId: creds.accountId || extractAccountId(creds.apiKey) };
    setCredentials(withId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withId));
    setActiveSection("overview");
  };

  const handleNavigate = (section: string, params?: Record<string, string>) => {
    setNavParams(params || {});
    setActiveSection(section as Section);
  };

  const hasCredentials = !!credentials.apiKey && !!credentials.orgId && !!credentials.projectId;

  if (view === "home") {
    return (
      <MainLayout currentView="harness">
        <DeploymentHome onSelect={setView} />
      </MainLayout>
    );
  }

  if (view === "troubleshooting") {
    return (
      <MainLayout currentView="harness">
        <TroubleshootingMcpView onBack={() => setView("home")} />
      </MainLayout>
    );
  }

  return (
    <MainLayout currentView="harness">
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Internal left nav */}
        <div className="w-44 border-r border-border bg-muted/10 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              DevOps
            </h2>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavigate(id)}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer",
                  activeSection === id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {hasCredentials && (
            <div className="p-3 border-t border-border">
              <div className="text-xs text-muted-foreground truncate">
                <div className="font-medium truncate">{credentials.orgId}</div>
                <div className="truncate">{credentials.projectId}</div>
              </div>
            </div>
          )}
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-auto">
          {activeSection === "settings" && (
            <SettingsSection credentials={credentials} onSave={handleSaveCredentials} />
          )}

          {activeSection === "overview" && hasCredentials && (
            <OverviewSection credentials={credentials} onNavigate={handleNavigate} />
          )}

          {activeSection === "pipelines" && hasCredentials && (
            <PipelinesSection credentials={credentials} />
          )}

          {activeSection === "deployments" && hasCredentials && (
            <DeploymentsSection credentials={credentials} onNavigate={handleNavigate} />
          )}

          {activeSection === "logs" && hasCredentials && (
            <LogsSection
              credentials={credentials}
              preloadedExecutionId={navParams.executionId}
            />
          )}

          {activeSection === "terraform" && (
            <TerraformGeneratorCore />
          )}

          {activeSection !== "settings" && !hasCredentials && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm text-muted-foreground">
                Configure your Harness credentials to get started
              </p>
              <button
                onClick={() => setActiveSection("settings")}
                className="text-sm text-primary underline"
              >
                Go to Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {hasCredentials && <ChatWidget credentials={credentials} />}
    </MainLayout>
  );
}

// ─── Landing view: two cards ─────────────────────────────────────────────────

const DEVOPS_TAGS = ["Pipelines", "Deployments", "Logs", "Terraform"];
const MCP_TAGS = ["Failed pipelines", "RAG search", "Confluence + Jira", "IDE-native"];

const DEVOPS_BULLETS = [
  "Connect Harness credentials and pick your org/project",
  "Browse pipelines, view executions, and tail step logs",
  "AI-summarize failed runs and propose YAML fixes",
  "Generate Terraform from natural-language prompts",
];

const MCP_BULLETS = [
  "List recent failed Harness executions from your IDE",
  "Fetch step logs, pipeline YAML, and the execution graph",
  "Retrieve matching Confluence runbooks and Jira tickets via RAG",
  "Receive an objective infrastructure-vs-application-code verdict",
];

const DeploymentHome = ({ onSelect }: { onSelect: (v: DeploymentView) => void }) => (
  <div className="p-6 max-w-5xl mx-auto">
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Rocket className="w-[18px] h-[18px] text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Deployment</h1>
      </div>
      <p className="text-sm ml-12 text-muted-foreground">
        Manage your DevOps pipelines or troubleshoot deployment issues with MCP.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DeploymentCard
        icon={Workflow}
        title="DevOps"
        description="Manage your Harness deployment lifecycle end-to-end — pipelines, executions, logs, and infrastructure-as-code — with AI-powered analysis on failed runs."
        bullets={DEVOPS_BULLETS}
        tags={DEVOPS_TAGS}
        ctaLabel="Open DevOps"
        onClick={() => onSelect("devops")}
      />
      <DeploymentCard
        icon={Wrench}
        title="Troubleshooting using MCP"
        badge="Developer flow"
        description="Accelerate root-cause analysis on failed pipelines and reduce friction between development and operations teams. An MCP tool in your IDE consolidates Harness logs, the pipeline YAML, and matched past incidents, then provides the AI with unified context for an objective root-cause verdict."
        bullets={MCP_BULLETS}
        tags={MCP_TAGS}
        ctaLabel="Open Troubleshooting"
        onClick={() => onSelect("troubleshooting")}
      />
    </div>
  </div>
);

interface DeploymentCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  bullets?: string[];
  tags: string[];
  ctaLabel: string;
  badge?: string;
  onClick: () => void;
}

const DeploymentCard = ({ icon: Icon, title, description, bullets, tags, ctaLabel, badge, onClick }: DeploymentCardProps) => (
  <button
    onClick={onClick}
    className="text-left relative overflow-hidden rounded-2xl border border-border p-6 bg-card hover:border-primary hover:shadow-xl transition-all duration-200 group"
  >
    <div className="absolute top-0 left-0 right-0 h-[3px] bg-primary rounded-t-2xl" />

    <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-5 mt-2 shadow-sm bg-primary/10">
      <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
    </div>

    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {badge && (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary uppercase tracking-wider">
          {badge}
        </span>
      )}
    </div>
    <p className="text-sm leading-relaxed mb-5 text-muted-foreground">{description}</p>

    {bullets && bullets.length > 0 && (
      <ul className="space-y-2 mb-5">
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    )}

    <div className="flex flex-wrap gap-2 mb-6">
      {tags.map(tag => (
        <span
          key={tag}
          className="text-xs px-3 py-1 rounded-full font-medium bg-primary/10 text-primary"
        >
          {tag}
        </span>
      ))}
    </div>

    <div className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-3 transition-all duration-200">
      {ctaLabel} <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </div>
  </button>
);

// ─── Troubleshooting using MCP — explainer page ──────────────────────────────

const PROBLEMS: { icon: React.ElementType; text: string }[] = [
  { icon: MessageSquareWarning, text: "Failure screenshots are exchanged between development and operations teams in chat" },
  { icon: Scale, text: "Each team has a natural bias toward attributing the failure to the other" },
  { icon: Search, text: "The actual cause — infrastructure configuration or application code — gets obscured in the back-and-forth" },
];

type FlowStep = {
  icon: React.ElementType;
  title: string;
  body: string;
  screenshot?: { src: string; alt: string; caption: React.ReactNode };
};

const USER_STEPS: FlowStep[] = [
  {
    icon: Rocket,
    title: "Request recent failures",
    body: "From your IDE (VS Code, Cursor, Claude Desktop), invoke list_recent_failures to review the latest failed Harness executions in this project.",
    screenshot: {
      src: "/troubleshooting-mcp/1-list-failures.png",
      alt: "IDE chat showing list_recent_failures returning a table of the 10 most recent failed Harness executions with execution IDs and triggers",
      caption: (
        <>
          Above: the user typed <em>"get recent pipeline failures"</em> — MCP returned 10 failed runs with their execution IDs and triggers.
        </>
      ),
    },
  },
  {
    icon: MousePointerClick,
    title: "Pick a failure to analyze",
    body: "From the list returned in step 1, tell the IDE which run to investigate — by row number (e.g. \"analyze #1\"), the planExecutionId, or a full Harness UI execution URL. Nothing runs automatically; you decide what gets analyzed, and the IDE AI invokes analyze_pipeline_failure for you.",
    screenshot: {
      src: "/troubleshooting-mcp/2-analyze-failure.png",
      alt: "IDE invoking analyze_pipeline_failure on execution xYtzDZoNSM2tV_uppXJ8lQ and returning the curated Markdown payload",
      caption: (
        <>
          Above: the user said <em>"no 1 pipeline"</em> — the IDE AI resolved that to row #1 from the previous list (execution <code className="px-1 rounded bg-muted">xYtzDZoNSM2tV_uppXJ8lQ</code>) and called <code className="px-1 rounded bg-muted">analyze_pipeline_failure</code>. Nothing kicked off until the user asked.
        </>
      ),
    },
  },
  {
    icon: CheckCircle2,
    title: "Review the AI verdict",
    body: "Read the IDE AI's grounded root-cause analysis — infrastructure configuration vs application code — with citations to the matched past incidents, and proceed with the fix.",
    screenshot: {
      src: "/troubleshooting-mcp/3-ai-verdict.png",
      alt: "IDE AI output classifying the failure as Pipeline / infra misconfiguration with a divergence analysis and a two-option fix",
      caption: (
        <>
          Above: classified as <strong className="text-foreground">"Pipeline / infra misconfiguration"</strong> — <code className="px-1 rounded bg-muted">npm run start</code> mismatched the committed YAML's <code className="px-1 rounded bg-muted">npm run build</code>, with two concrete fix options. The AI also transparently flagged that the RAG backend was momentarily unreachable — graceful degradation rather than silent guesswork.
        </>
      ),
    },
  },
];

interface AnalysisItem {
  icon: React.ElementType;
  label: string;
  detail: string;
}

interface AnalysisHalf {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  items: AnalysisItem[];
}

const ANALYSIS_SOURCES: AnalysisHalf[] = [
  {
    icon: Cpu,
    title: "From MCP",
    subtitle: "Roughly half — pulled fresh per analysis",
    items: [
      { icon: GitBranch, label: "Harness", detail: "Execution details, failed steps, capped step logs, and pipeline YAML" },
      { icon: BookOpen, label: "Confluence", detail: "Runbooks and post-mortems matched via RAG" },
      { icon: Bug, label: "Jira", detail: "Past pipeline-failure tickets and their resolutions" },
    ],
  },
  {
    icon: Code2,
    title: "From your codebase",
    subtitle: "The other half — the IDE AI is already here, no extra plumbing",
    items: [
      { icon: FileCode2, label: "Source files", detail: "Project structure and the actual code referenced by the pipeline" },
      { icon: FileText, label: "Manifests & configs", detail: "package.json, lockfiles, env files, build configs" },
      { icon: Search, label: "Cross-checks", detail: "Verifies pipeline-side claims against codebase reality" },
    ],
  },
];

const SAMPLE_BLOB = `## Pipeline Failure Analysis

### Execution Summary
- Pipeline: deploy-prod
- Execution ID: gM7fK3vQTimWxYzZ_abc
- Status: Failed
- Triggered by: WEBHOOK
- Started: 1777654310000 | Ended: 1777654522000

### Pipeline YAML
\`\`\`yaml
pipeline:
  name: deploy-prod
  stages:
    - stage:
        name: Apply Helm Chart
        type: Deployment
        spec:
          deploymentType: Kubernetes
          execution:
            steps:
              - step:
                  name: Apply Helm Chart
                  type: HelmDeploy
                  spec:
                    namespace: prod
                    secrets:
                      - db-creds
\`\`\`

### Failed Steps
#### Apply Helm Chart (HELM_DEPLOY)
- Error: Secret "db-creds" not found in namespace "prod"
- Failure types: APPLICATION_ERROR
- Window: 1777654410000 → 1777654522000

##### Logs
\`\`\`
Error: secret "db-creds" not found
helm.go:84: [debug] release prod-app failed
release prod-app failed: secret "db-creds" not found
\`\`\`

### Organizational Context (from RAG)
#### KB-417 — "Pipeline fails when secret 'db-creds' is rotated"  _(source: confluence)_
After rotating the database credentials, the Helm release in prod cannot mount the
secret because the new secret is provisioned in a different namespace. Resolution:
re-create the secret in 'prod' namespace via the credentials-bootstrap pipeline.

#### JIRA-2049 — "Helm release blocked by missing service account"  _(source: jira)_
Service account 'helm-deployer' was deleted during cluster cleanup. Restored via
terraform apply on the iam module. Closed on 2026-03-12.`;

const TroubleshootingMcpView = ({ onBack }: { onBack: () => void }) => (
  <div className="p-6 max-w-5xl mx-auto">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      Back to Deployment
    </button>

    {/* Header */}
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wrench className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Troubleshooting using MCP</h1>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary uppercase tracking-wider">
          Developer flow
        </span>
      </div>
      <p className="text-sm ml-12 text-muted-foreground max-w-3xl">
        Diagnose failed pipelines faster with complete context. The MCP tool consolidates Harness execution data, the pipeline YAML, and matched past incidents from Confluence and Jira, then provides the IDE AI with a balanced payload for an objective root-cause analysis.
      </p>
    </div>

    {/* Audience framing — this is a developer story */}
    <div className="mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Code2 className="w-5 h-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground mb-1">A developer flow, lived inside the IDE</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This walkthrough assumes you've already installed the <code className="px-1 rounded bg-muted text-foreground">pipeline-analyzer</code> MCP server in your IDE (VS Code, Cursor, or Claude Desktop). The whole troubleshooting loop is built to happen there — where you already work, where the codebase lives, and where the IDE AI already has context. No separate tool, no context-switching out of your editor.
        </p>
      </div>
    </div>

    {/* Why this exists */}
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-foreground mb-4">Why this exists</h2>
      <div className="rounded-2xl border border-border bg-card p-6">
        <ul className="space-y-3">
          {PROBLEMS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground pt-1.5">{text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-foreground pt-4 mt-4 border-t border-border">
          The MCP tool delivers the IDE AI the complete picture — Harness execution data, the pipeline YAML, and organizational incident history — so the analysis is grounded in evidence rather than inferred from a single perspective.
        </p>
      </div>
    </section>

    {/* How to use — linear user steps with inline screenshots */}
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-foreground mb-1">How to use it</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Three actions from your IDE — the rest is automatic. Each step shown with a real run on <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">sdlc-vitereact-frontend-CI</code>.
      </p>
      <ol className="space-y-6">
        {USER_STEPS.map(({ icon: Icon, title, body, screenshot }, i) => (
          <li key={title} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 flex gap-4">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                  <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
            {screenshot && (
              <>
                <div className="bg-muted/20 border-t border-border p-4 flex justify-center">
                  <img
                    src={screenshot.src}
                    alt={screenshot.alt}
                    loading="lazy"
                    className="block max-h-[420px] w-auto max-w-full rounded-lg border border-border shadow-sm"
                  />
                </div>
                <p className="px-5 py-3 text-xs text-muted-foreground leading-relaxed border-t border-border">
                  {screenshot.caption}
                </p>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>

    {/* Where the analysis is grounded — MCP + codebase */}
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-foreground mb-1">Where the analysis is grounded</h2>
      <p className="text-sm text-muted-foreground mb-4">
        The IDE AI doesn't decide in a vacuum. Roughly 50/50 between deployment context (from MCP) and codebase context (already accessible in your IDE) — fusing both is what makes the verdict precise.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {ANALYSIS_SOURCES.map(({ icon: HeadIcon, title, subtitle, items }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5 flex flex-col">
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <HeadIcon className="w-[18px] h-[18px] text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <ul className="space-y-3 flex-1">
              {items.map(({ icon: ItemIcon, label, detail }) => (
                <li key={label} className="flex items-start gap-3">
                  <ItemIcon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <p className="text-sm text-foreground leading-relaxed">
          <strong>Why this matters:</strong> in the run shown above, MCP supplied the pipeline YAML expecting <code className="px-1 rounded bg-muted">npm run start</code>. The codebase showed <code className="px-1 rounded bg-muted">package.json</code> had no such script. The IDE AI fused both halves and pinpointed the exact mismatch — neither source alone could have spotted it.
        </p>
      </div>
    </section>

    {/* MCP response shape */}
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-foreground mb-2">How the MCP response looks</h2>
      <p className="text-sm text-muted-foreground mb-4">
        After step 2, <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">analyze_pipeline_failure</code> returns a single curated Markdown payload to your IDE — execution summary, pipeline YAML, failed steps with logs, and RAG-matched past incidents from Confluence and Jira:
      </p>
      <pre className="rounded-2xl border border-border bg-muted/30 p-5 text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre">
        <code>{SAMPLE_BLOB}</code>
      </pre>
      <p className="text-xs text-muted-foreground mt-3 italic">
        Your IDE AI then reasons over this unified payload and returns the root-cause classification (infrastructure configuration vs application code) along with citations to the matched past incidents.
      </p>
    </section>

    {/* Footer */}
    <p className="text-xs text-muted-foreground text-center mt-12">
      The MCP server itself ships in our remote package — install it from your IDE's MCP config.
    </p>
  </div>
);

