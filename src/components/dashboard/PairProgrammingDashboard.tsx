import { useState, useRef, useEffect, useCallback } from "react";
import "./PairProgrammingDashboard.css";
import { ArrowLeft, Copy, Check, Terminal, Globe, Package, ChevronRight, Info, Code2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/contexts/AppStateContext";
import { API_CONFIG } from "@/config/api";
import { THEME } from "@/config/theme";
import { triggerIncrementalSync, getSyncStatus } from "@/services/orchestrationApi";
import { toast } from "sonner";

interface PairProgrammingDashboardProps {
    onBack?: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className={`absolute top-3 right-3 p-1.5 rounded-md text-xs flex items-center gap-1 transition-all ${copied ? 'pp-copy-btn-copied' : 'pp-copy-btn'}`}
            title="Copy to clipboard"
        >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
    );
};

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => (
    <div className="relative rounded-lg overflow-hidden mt-3 mb-4 pp-code-block">
        <div className="flex items-center gap-2 px-4 py-2 border-b pp-code-header">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 opacity-70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-70" />
            </div>
            <span className="text-xs ml-1 pp-code-lang">{language}</span>
        </div>
        <div className="relative">
            <CopyButton text={code} />
            <pre className="px-5 py-4 overflow-x-auto text-sm leading-relaxed pp-code-pre">
                <code>{code}</code>
            </pre>
        </div>
    </div>
);

const StepBadge = ({ number }: { number: number }) => (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 pp-step-badge">
        {number}
    </div>
);

const InfoBox = ({ children }: { children: React.ReactNode }) => (
    <div className="flex gap-3 p-4 rounded-lg mt-3 mb-4 text-sm pp-info-box">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>{children}</div>
    </div>
);

export const PairProgrammingDashboard = ({ onBack }: PairProgrammingDashboardProps) => {
    const { selectedProject, isSyncInProgress, setIsSyncInProgress, syncMessage, setSyncMessage } = useAppState();
    const [frontendReqs, setFrontendReqs] = useState("");
    const [backendReqs, setBackendReqs] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Poll sync status
    const pollSyncStatus = useCallback(async () => {
        if (!selectedProject?.project_id) return;
        try {
            const status = await getSyncStatus(selectedProject.project_id);
            if (status) {
                setIsSyncInProgress(status.is_syncing);
                setSyncMessage(status.sync_message || "");
            }
        } catch {
            // Silently ignore polling errors
        }
    }, [selectedProject?.project_id, setIsSyncInProgress, setSyncMessage]);

    useEffect(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        if (selectedProject?.project_id) {
            pollSyncStatus();
            pollIntervalRef.current = setInterval(() => {
                if (isSyncInProgress || isSyncing) {
                    pollSyncStatus();
                }
            }, 5000);
        } else {
            setIsSyncInProgress(false);
            setSyncMessage("");
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [selectedProject?.project_id, pollSyncStatus, isSyncInProgress, isSyncing, setIsSyncInProgress, setSyncMessage]);

    const handleSync = async () => {
        if (!selectedProject?.project_id) {
            toast.error("No project selected");
            return;
        }

        setIsSyncing(true);
        try {
            const result = await triggerIncrementalSync(selectedProject.project_id);
            if (result.success) {
                toast.success("Sync started! Only changed documents will be updated.");
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to start sync");
        } finally {
            setIsSyncing(false);
        }
    };

    const projectId = selectedProject?.project_id || "<YOUR_PROJECT_ID>";
    const apiUrl = THEME === 'siriusai' ? "https://sdlc.siriusai.com" : "https://sdlc-dev.deluxe.com";
    const apiKey = THEME === 'siriusai' ? "dev-key" : "dev-key-aman";

    const githubRepo = THEME === 'siriusai'
        ? "https://github.com/arushsingh17/mcp.git"
        : "https://bitbucket.org/deluxe-development/sdlc_mcp.git";

    const techStackEnv = {
        ...(frontendReqs && { FRONTEND_REQUIREMENTS: frontendReqs }),
        ...(backendReqs && { BACKEND_REQUIREMENTS: backendReqs }),
    };

    const serverEnv = {
        PROJECT_ID: projectId,
        API_URL: apiUrl,
        API_KEY: apiKey,
        ...techStackEnv,
    };

    // Config JSON for .venv install — Windows (Scripts + .exe)
    const venvConfigJson = JSON.stringify(
        {
            servers: {
                "enhance-prompt": {
                    command: "<PATH_TO_YOUR_VENV>/Scripts/prompt-enhancer-mcp.exe",
                    env: serverEnv,
                },
            },
        },
        null,
        2
    );

    // Config JSON for Linux/Mac .venv
    const venvConfigJsonLinux = JSON.stringify(
        {
            servers: {
                "enhance-prompt": {
                    command: "<PATH_TO_YOUR_VENV>/bin/prompt-enhancer-mcp",
                    env: serverEnv,
                },
            },
        },
        null,
        2
    );

    // Config JSON for global install
    const globalConfigJson = JSON.stringify(
        {
            servers: {
                "enhance-prompt": {
                    command: "prompt-enhancer-mcp",
                    env: serverEnv,
                },
            },
        },
        null,
        2
    );



    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white min-h-full">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <Button variant="ghost" size="sm" onClick={onBack} className="p-2 hover:bg-accent">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center pp-header-icon">
                            <Code2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Pair Programming Setup</h1>
                            <p className="text-sm text-gray-500">
                                Connect your AI coding assistant to {selectedProject ? <><strong>{selectedProject.project_name}</strong>'s</> : "your"} knowledge base
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Project Context Banner */}
            {selectedProject ? (
                <div className="rounded-xl p-4 mb-6 flex items-center gap-3 pp-project-banner">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 pp-project-icon">
                        <Package className="w-4 h-4 pp-project-icon-color" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">Active Project: {selectedProject.project_name}</p>
                        <p className="text-xs text-gray-500 truncate">Project ID: <code className="font-mono bg-gray-100 px-1 rounded">{projectId}</code></p>
                    </div>
                    <div className="px-2 py-1 rounded-full text-xs font-medium pp-project-badge">
                        ✓ Config auto-filled
                    </div>
                </div>
            ) : (
                <div className="rounded-xl p-4 mb-6 flex items-center gap-3 pp-warning-banner">
                    <Info className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">
                        <strong>No project selected.</strong> Select a project from the top bar to auto-fill your Project ID in the config snippets below.
                    </p>
                </div>
            )}

            {/* Sync Knowledge Base */}
            {selectedProject && (
                <div className="rounded-xl border border-yellow-300 p-4 mb-6 bg-yellow-50">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                Sync Knowledge Base Before You Start
                            </p>
                            <p className="text-xs text-yellow-700 mt-1 ml-5.5" style={{ marginLeft: "1.375rem" }}>
                                <strong>Important:</strong> The MCP server queries your vector database to provide accurate context. Syncing updates your Confluence pages and Jira issues into the vector DB.
                                If your docs have changed recently, hit <strong>Sync Docs</strong> to ensure your AI coding assistant has the latest information.
                            </p>
                        </div>
                        <Button
                            onClick={handleSync}
                            disabled={isSyncing || isSyncInProgress}
                            size="sm"
                            variant="outline"
                            className="gap-2 ml-4 flex-shrink-0"
                        >
                            <RefreshCw className={`w-4 h-4 ${(isSyncing || isSyncInProgress) ? "animate-spin" : ""}`} />
                            {isSyncing ? "Syncing..." : "Sync Docs"}
                        </Button>
                    </div>
                    {isSyncInProgress && (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            <span className="truncate">{syncMessage || "Syncing your knowledge base..."}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-4xl space-y-8">

                {/* Section 1: Overview */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">What is the Prompt Enhancer MCP?</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { icon: "🧠", title: "Context-Aware", desc: "The server enriches your task with context from your project's knowledge base and BRDs — the redesigned prompt is displayed back to you in your IDE" },
                            { icon: "⚡", title: "Real-time", desc: "Ask a task, get back an enhanced prompt instantly — scoped to your selected project's documentation" },
                            { icon: "🔌", title: "IDE Integration", desc: "Works with any MCP-compatible IDE: Cursor, VS Code, Claude Desktop, Windsurf" },
                        ].map((card) => (
                            <div key={card.title} className="rounded-xl p-4 pp-feature-card">
                                <div className="text-2xl mb-2">{card.icon}</div>
                                <div className="text-sm font-semibold text-gray-800 mb-1">{card.title}</div>
                                <div className="text-xs text-gray-500 leading-relaxed">{card.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section 2: Pre-requisites */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">Pre-requisites</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                        {[
                            { icon: "🐍", label: "Python 3.10+" },
                            { icon: "🔧", label: "Git installed" },
                            { icon: "💻", label: "VS Code Copilot / Claude Code / Cursor" },
                        ].map((item) => (
                            <div key={item.label} className="rounded-lg p-3 text-center pp-feature-card">
                                <div className="text-xl mb-1">{item.icon}</div>
                                <div className="text-xs font-medium text-gray-700">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Section 3: Setup Steps */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">Setup Steps</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>

                    <div className="space-y-6">
                        {/* Step 1: Open project */}
                        <div className="flex gap-4">
                            <StepBadge number={1} />
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-800 mb-1">Open your project in VS Code</h3>
                                <p className="text-sm text-gray-500">Open the project folder where you want to use the MCP-powered AI assistant.</p>
                            </div>
                        </div>

                        {/* Step 2: Install MCP package — two paths */}
                        <div className="flex gap-4">
                            <StepBadge number={2} />
                            <div className="flex-1">
                                <div className="rounded-xl p-4 border-2 border-blue-200 bg-blue-50/30">
                                    <h3 className="font-bold text-gray-900 mb-1 text-base">Install the MCP package</h3>
                                    <p className="text-sm text-gray-600 mb-3">Choose one of the two options below:</p>

                                    {/* Option A: global */}
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Option A — Global Install (recommended)</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-1">No virtual environment needed — installs the command directly into your system PATH:</p>
                                        <CodeBlock language="bash" code={`pip install git+${githubRepo}`} />
                                    </div>

                                    {/* Option B: venv */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Option B — Virtual Environment</span>
                                        </div>

                                        <p className="text-xs text-gray-500 mb-0">1. Create the virtual environment <span className="bg-yellow-100 text-yellow-800 font-semibold px-1.5 py-0.5 rounded text-xs">(skip if you already have one)</span>:</p>
                                        <CodeBlock language="bash" code={`python -m venv .venv`} />

                                        <p className="text-xs text-gray-500 mb-0">2. Activate it:</p>
                                        <p className="text-xs font-semibold text-gray-400 mt-2 mb-0">🪟 Windows</p>
                                        <CodeBlock language="bash" code={`.venv\\Scripts\\activate`} />
                                        <p className="text-xs font-semibold text-gray-400 mt-1 mb-0">🍎 macOS / Linux</p>
                                        <CodeBlock language="bash" code={`source .venv/bin/activate`} />

                                        <p className="text-xs text-gray-500 mb-0">3. Install the package:</p>
                                        <CodeBlock language="bash" code={`pip install git+${githubRepo}`} />
                                    </div>

                                    <p className="text-xs text-gray-500 mt-1">Verify installation:</p>
                                    <CodeBlock
                                        language="bash"
                                        code={`prompt-enhancer-mcp --help`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Create MCP config */}
                        <div className="flex gap-4">
                            <StepBadge number={3} />
                            <div className="flex-1">
                                <div className="rounded-xl p-4 border-2 border-blue-200 bg-blue-50/30">
                                    <h3 className="font-bold text-gray-900 mb-1 text-base">Create the MCP config file</h3>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Create <code className="bg-blue-50 px-1 rounded font-mono text-xs">.vscode/mcp.json</code> in your project root (or the appropriate config path for your IDE — see table below) and paste the config from the <strong>MCP Configuration</strong> section.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Section 4: MCP Config */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">MCP Configuration File</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                        Add the following to your IDE's MCP config file. The config differs based on <strong>where you installed the package</strong>.
                    </p>

                    {/* Config location table */}
                    <div className="rounded-xl overflow-hidden mb-5 pp-table-container">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="pp-table-header">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">IDE / Tool</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">Config File Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { tool: "VS Code + GitHub Copilot", path: ".vscode/mcp.json" },
                                ].map((row, i) => (
                                    <tr key={row.tool} className={i % 2 === 0 ? 'pp-table-row-even' : 'pp-table-row-odd'}>
                                        <td className="px-4 py-3 font-medium text-gray-700 border-b pp-table-cell-border whitespace-nowrap">{row.tool}</td>
                                        <td className="px-4 py-3 text-gray-500 border-b pp-table-cell-border font-mono text-xs">
                                            {row.path.split('\n').map((line, j) => <div key={j}>{line}</div>)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Tech Stack Inputs */}
                    <div className="rounded-xl p-4 mb-5 pp-info-box">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Tech Stack (optional)</p>
                        <p className="text-xs text-gray-500 mb-3">
                            In addition to the context retrieved from your Jira and Confluence docs, you can specify your project's tech stack here. These values are included alongside the documentation context when generating the enhanced prompt — useful when stack details are missing or outdated in your docs. If filled, they are added to the copied config as <code className="font-mono bg-blue-50 px-1 rounded">FRONTEND_REQUIREMENTS</code> and <code className="font-mono bg-blue-50 px-1 rounded">BACKEND_REQUIREMENTS</code>.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Frontend Requirements</label>
                                <input
                                    type="text"
                                    value={frontendReqs}
                                    onChange={(e) => setFrontendReqs(e.target.value)}
                                    placeholder="e.g. React 18, TypeScript, TailwindCSS"
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Backend Requirements</label>
                                <input
                                    type="text"
                                    value={backendReqs}
                                    onChange={(e) => setBackendReqs(e.target.value)}
                                    placeholder="e.g. Python FastAPI, PostgreSQL, Redis"
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Config for global */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Option A: Installed Globally (pip) <span className="text-xs font-normal text-blue-600 ml-1">(recommended)</span>
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Use this when you installed the package globally — the command is available in your system PATH.</p>
                        <CodeBlock language="json" code={globalConfigJson} />
                    </div>

                    {/* Config for .venv */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Terminal className="w-4 h-4 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Option B: Installed in <code className="font-mono text-sm bg-gray-100 px-1.5 rounded">.venv</code>
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Use this when you installed inside a virtual environment. The path to the executable differs by OS.</p>

                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-3 mb-0">
                            🪟 Windows — uses <code className="font-mono">.venv\Scripts\prompt-enhancer-mcp.exe</code>
                        </h4>
                        <CodeBlock language="json" code={venvConfigJson} />

                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-3 mb-0">
                            🍎 macOS / Linux — uses <code className="font-mono">.venv/bin/prompt-enhancer-mcp</code>
                        </h4>
                        <CodeBlock language="json" code={venvConfigJsonLinux} />

                        <InfoBox>
                            On <strong>Windows</strong>, pip creates the executable at <code className="bg-blue-50 px-1 rounded font-mono text-xs">.venv\Scripts\prompt-enhancer-mcp.exe</code>. On <strong>macOS/Linux</strong>, it's at <code className="bg-blue-50 px-1 rounded font-mono text-xs">.venv/bin/prompt-enhancer-mcp</code> (no .exe). Use an absolute path if your IDE doesn't resolve relative paths from the project root.
                        </InfoBox>
                    </div>

                    {/* Important note after all config options */}
                    <div className="mt-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="text-sm font-bold text-amber-900">Important: Reload after pasting the config</p>
                                <p className="text-sm text-amber-800 mt-1">
                                    After pasting the config into your <code className="bg-amber-100 px-1 rounded font-mono text-xs">mcp.json</code> file, press <kbd className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold">Ctrl+S</kbd> to save, then run <strong>Developer: Reload Window</strong> from the command palette (<kbd className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold">Ctrl+Shift+P</kbd> → type "Reload Window") for the MCP server to start.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 4: Environment Variables */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">Environment Variables Reference</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>

                    <div className="rounded-xl overflow-hidden pp-table-container">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="pp-table-header">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">Variable</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">Required</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">Value</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 border-b pp-table-border">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        key: "PROJECT_ID",
                                        required: true,
                                        value: projectId,
                                        desc: "Your project's unique identifier. This scopes all RAG queries to this project's documentation.",
                                        highlight: !!selectedProject,
                                    },
                                    {
                                        key: "API_URL",
                                        required: true,
                                        value: apiUrl,
                                        desc: "The base URL of the deployed SDLC backend.",
                                        highlight: true,
                                    },
                                    {
                                        key: "API_KEY",
                                        required: true,
                                        value: apiKey,
                                        desc: "Your API key for authenticating requests to the backend.",
                                        highlight: true,
                                    },
                                    {
                                        key: "FRONTEND_REQUIREMENTS",
                                        required: false,
                                        value: frontendReqs || "—",
                                        desc: "Your project's frontend tech stack (e.g. React 18, TypeScript, TailwindCSS). Used by the prompt enhancer to supplement documentation context. Takes priority over any conflicting stack info found in docs.",
                                        highlight: !!frontendReqs,
                                    },
                                    {
                                        key: "BACKEND_REQUIREMENTS",
                                        required: false,
                                        value: backendReqs || "—",
                                        desc: "Your project's backend tech stack (e.g. Python FastAPI, PostgreSQL, Redis). Used by the prompt enhancer to supplement documentation context. Takes priority over any conflicting stack info found in docs.",
                                        highlight: !!backendReqs,
                                    },
                                ].map((row, i) => (
                                    <tr key={row.key} className={i % 2 === 0 ? 'pp-table-row-even' : 'pp-table-row-odd'}>
                                        <td className="px-4 py-3 border-b pp-table-cell-border font-mono font-semibold text-xs pp-env-key">{row.key}</td>
                                        <td className="px-4 py-3 border-b pp-table-cell-border">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.required ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                                {row.required ? "Required" : "Optional"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b pp-table-cell-border font-mono text-xs max-w-xs">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded truncate ${row.highlight ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                                title={row.value}
                                            >
                                                {row.value}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-b pp-table-cell-border text-xs text-gray-500 leading-relaxed">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Section 5: Test the Connection */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">Test the Connection</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                        Once configured, try the MCP tool in your IDE by typing a coding task. The server will enrich it with context gathered from your project's knowledge base — the <strong>redesigned prompt is displayed directly back to you</strong> in your IDE.
                    </p>

                    <div className="space-y-4">
                        {/* Two calling methods side by side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Explicit */}
                            <div className="rounded-xl p-4 pp-card-light">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full pp-badge-natural">Natural Language</span>
                                    <span className="text-xs text-gray-500">— just type your task</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Prefix your message with <code className="bg-gray-100 px-1 rounded font-mono">enhance</code> to guarantee Copilot picks up the MCP server before doing anything. Without this, Copilot may skip the tool and answer from its own knowledge.
                                </p>
                                <div className="rounded-lg p-3 text-xs font-mono leading-relaxed pp-terminal-block">
                                    <span className="pp-terminal-comment"># What you type in your AI chat:</span>
                                    <br /><br />
                                    <span className="pp-terminal-keyword">using mcp enhance_task -</span>
                                    <span className="pp-terminal-value"> implement login functionality</span>
                                    <br /><br />
                                    <span className="pp-terminal-keyword">using mcp enhance_task -</span>
                                    <span className="pp-terminal-value"> add payment screen</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">→ Copilot calls <code className="bg-gray-800 px-1 rounded">enhance_task</code>, fetches your project context, and shows you the enriched prompt before proceeding</p>
                            </div>

                            {/* Explicit / command */}
                            <div className="rounded-xl p-4 pp-card-light">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full pp-badge-mention">/ command</span>
                                    <span className="text-xs text-gray-500">— explicit selection</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Type <code className="bg-gray-100 px-1 rounded font-mono">/</code> in the Copilot chat — a picker appears. Select <code className="bg-gray-100 px-1 rounded font-mono">mcp.enhance-prompt.enhance_task</code> from the list, then type your task.
                                </p>
                                <div className="rounded-lg p-3 text-xs font-mono leading-relaxed pp-terminal-block">
                                    <span className="pp-terminal-comment"># Type / to open the command picker, then:</span>
                                    <br /><br />
                                    <span className="pp-terminal-mention">mcp.enhance-prompt.enhance_task</span>
                                    <br />
                                    <span className="pp-terminal-value">implement login functionality</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">→ Directly selects the tool — no ambiguity, Copilot always calls enhance_task</p>
                            </div>
                        </div>

                    {/* MCP Screenshots */}
                    <div className="space-y-6 mb-6">
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <span className="text-sm font-semibold text-gray-700">MCP Config & VS Code Copilot in Action</span>
                            </div>
                            <div className="p-4 space-y-4">
                                <img
                                    src="/{B5C30B42-E023-400C-BA9C-AD2EF4C824F4}.png"
                                    alt="VS Code Copilot showing MCP command picker with enhance-prompt"
                                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                                />
                                <img
                                    src="/{72543988-0535-4525-B016-137D2CDCAD85}.png"
                                    alt="VS Code with MCP config and Copilot chat showing enhance task"
                                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                        {/* What you'll get back */}
                        <div className="rounded-xl p-4 pp-card-light">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What you'll get back</div>
                            <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1 mb-1">🎫 From Jira</div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span>Linked tickets, acceptance criteria & user story details</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span>Sprint goals, priorities & task dependencies</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span>Known bugs, blockers & related issue history</span>
                                </div>

                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1">📘 From Confluence</div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <span>BRD context — enriched task with relevant requirements</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <span>Architecture decisions, design patterns & ADRs</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <span>Technical docs, API specs & architecture runbooks</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <span>Stakeholder requirements, compliance & team standards</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};
