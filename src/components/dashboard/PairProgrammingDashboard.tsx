import { useState } from "react";
import "./PairProgrammingDashboard.css";
import { ArrowLeft, Copy, Check, Terminal, Globe, Package, ChevronRight, Info, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/contexts/AppStateContext";
import { API_CONFIG } from "@/config/api";

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
    const { selectedProject } = useAppState();

    const projectId = selectedProject?.project_id || "<YOUR_PROJECT_ID>";
    const apiUrl = "https://sdlc-dev.deluxe.com";
    const apiKey = "dev-key-aman";

    const githubRepo = "https://bitbucket.org/deluxe-development/sdlc_mcp.git";

    // Config JSON for .venv install — Windows (Scripts + .exe)
    const venvConfigJson = JSON.stringify(
        {
            mcpServers: {
                "enhance-prompt": {
                    command: ".venv/Scripts/prompt-enhancer-mcp.exe",
                    env: {
                        PROJECT_ID: projectId,
                        API_URL: apiUrl,
                        API_KEY: apiKey,
                    },
                },
            },
        },
        null,
        2
    );

    // Config JSON for Linux/Mac .venv
    const venvConfigJsonLinux = JSON.stringify(
        {
            mcpServers: {
                "enhance-prompt": {
                    command: ".venv/bin/prompt-enhancer-mcp",
                    env: {
                        PROJECT_ID: projectId,
                        API_URL: apiUrl,
                        API_KEY: apiKey,
                    },
                },
            },
        },
        null,
        2
    );

    // Config JSON for global install
    const globalConfigJson = JSON.stringify(
        {
            mcpServers: {
                "enhance-prompt": {
                    command: "prompt-enhancer-mcp",
                    env: {
                        PROJECT_ID: projectId,
                        API_URL: apiUrl,
                        API_KEY: apiKey,
                    },
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

                {/* Section 2: Installation */}
                <section>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="h-px flex-1 pp-divider-left" />
                        <h2 className="text-base font-semibold text-gray-700 px-2">Installation</h2>
                        <div className="h-px flex-1 pp-divider-right" />
                    </div>

                    <div className="space-y-6">
                        {/* Step 1 - Single unified install */}
                        <div className="flex gap-4">
                            <StepBadge number={1} />
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-800 mb-1">Install the package</h3>
                                <p className="text-sm text-gray-500 mb-1">
                                    The install command is the same whether you're using a virtual environment or a global install.
                                </p>
                                <CodeBlock
                                    language="bash"
                                    code={`pip install git+${githubRepo}`}
                                />
                                <InfoBox>
                                    After installing, the <code className="bg-blue-50 px-1 rounded font-mono text-xs">prompt-enhancer-mcp</code> command will be available. The only difference between a <strong>.venv</strong> and <strong>global</strong> install is <strong>how you reference the command path in the MCP config</strong> — see the config section below.
                                </InfoBox>
                            </div>
                        </div>

                        {/* Step 2: Verify */}
                        <div className="flex gap-4">
                            <StepBadge number={2} />
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-800 mb-1">Verify installation</h3>
                                <p className="text-sm text-gray-500 mb-1">Run the following to confirm the command is available</p>
                                <CodeBlock
                                    language="bash"
                                    code={`prompt-enhancer-mcp --help`}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 3: MCP Config */}
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
                                    { tool: "Cursor", path: "~/.cursor/mcp.json  (or .cursor/mcp.json in project root)" },
                                    { tool: "Claude Desktop", path: "~/Library/Application Support/Claude/claude_desktop_config.json  (macOS)\n%APPDATA%\\Claude\\claude_desktop_config.json  (Windows)" },
                                    { tool: "VS Code (Cline)", path: ".vscode/cline_mcp_settings.json" },
                                    { tool: "Windsurf", path: "~/.codeium/windsurf/mcp_config.json" },
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

                    {/* Config for .venv */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Terminal className="w-4 h-4 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Option A: Installed in <code className="font-mono text-sm bg-gray-100 px-1.5 rounded">.venv</code>
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

                    {/* Config for global */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Option B: Installed Globally (pip)
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Use this when you installed the package globally — the command is available in your system PATH.</p>

                        <CodeBlock language="json" code={globalConfigJson} />
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

                {/* Section 5: Quick Test */}
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
                                    Just prefix your task with <code className="bg-gray-100 px-1 rounded font-mono">enhance</code> — that's it. The AI automatically calls <code className="bg-gray-100 px-1 rounded font-mono">enhance_task</code> and returns the enriched prompt.
                                </p>
                                <div className="rounded-lg p-3 text-xs font-mono leading-relaxed pp-terminal-block">
                                    <span className="pp-terminal-comment"># What you type in your AI chat:</span>
                                    <br /><br />
                                    <span className="pp-terminal-keyword">enhance</span>
                                    <span className="pp-terminal-value"> implement frontend design</span>
                                    <br /><br />
                                    <span className="pp-terminal-keyword">enhance</span>
                                    <span className="pp-terminal-value"> add JWT login flow</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">→ The AI calls the tool, fetches your project context, and shows you the enriched prompt</p>
                            </div>

                            {/* Implicit */}
                            <div className="rounded-xl p-4 pp-card-light">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full pp-badge-mention">@mention</span>
                                    <span className="text-xs text-gray-500">— pin the server directly</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Pin the tool using <code className="bg-gray-100 px-1 rounded font-mono">@mcp:enhance-prompt</code> in your message — the IDE routes it to the correct tool automatically.
                                </p>
                                <div className="rounded-lg p-3 text-xs font-mono leading-relaxed pp-terminal-block">
                                    <span className="pp-terminal-comment"># What you type in your AI chat:</span>
                                    <br /><br />
                                    <span className="pp-terminal-mention">@mcp:enhance-prompt:enhance_task</span>
                                    <br />
                                    <span className="pp-terminal-value">implement frontend design</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">→ No extra instruction needed — the @mention directly triggers the tool</p>
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
