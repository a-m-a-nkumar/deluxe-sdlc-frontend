import { useEffect, useState } from "react";
import { Loader2, XCircle, ChevronDown, ChevronRight, Wand2, Wrench, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getExecutionLogs,
  aiSummarizeLogs,
  getPipelineDetail,
  aiAnalyzePipeline,
  aiEditPipeline,
  updatePipeline,
  buildConfig,
  type HarnessCredentials,
  type ExecutionLogs,
  type PipelineAnalysis,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
  preloadedExecutionId?: string;
}

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function calcDuration(startTs?: number, endTs?: number) {
  if (!startTs || !endTs) return "—";
  const ms = endTs - startTs;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function statusColor(status: string) {
  const s = status?.toUpperCase();
  if (s === "SUCCESS") return "text-green-600";
  if (["FAILED", "ERRORED"].includes(s)) return "text-red-600";
  if (s === "RUNNING") return "text-blue-600";
  return "text-gray-500";
}

export default function LogsSection({ credentials, preloadedExecutionId }: Props) {
  const config = buildConfig(credentials.apiKey);

  const [inputId, setInputId] = useState(preloadedExecutionId || "");
  const [executionId, setExecutionId] = useState(preloadedExecutionId || "");
  const [logs, setLogs] = useState<ExecutionLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Fix YAML state
  const [fixYaml, setFixYaml] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [fixError, setFixError] = useState("");
  const [savingYaml, setSavingYaml] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [fixDiff, setFixDiff] = useState<{ line: number; old: string; new: string }[]>([]);
  // Analysis state (step 1)
  const [analysis, setAnalysis] = useState<PipelineAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applyingFix, setApplyingFix] = useState(false);

  useEffect(() => {
    if (preloadedExecutionId) {
      setInputId(preloadedExecutionId);
      setExecutionId(preloadedExecutionId);
    }
  }, [preloadedExecutionId]);

  useEffect(() => {
    if (executionId) fetchLogs(executionId);
  }, [executionId]);

  const fetchLogs = async (id: string) => {
    setLoading(true);
    setError("");
    setLogs(null);
    setSummary("");
    try {
      const data = await getExecutionLogs(config, credentials.orgId, credentials.projectId, id);
      setLogs(data);
      // Auto-expand failed stages
      const failed = new Set(
        data.stages
          .filter(s => ["FAILED", "ERRORED"].includes(s.status?.toUpperCase()))
          .map(s => s.identifier)
      );
      setExpandedStages(failed);
    } catch (e: any) {
      setError(e.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!logs) return;
    setSummarizing(true);
    try {
      const result = await aiSummarizeLogs(config, logs);
      setSummary(result.summary);
    } catch (e: any) {
      setSummary(`Failed to analyze: ${e.message}`);
    } finally {
      setSummarizing(false);
    }
  };

  // Step 1 — Analyze: find the exact problem, propose change, ask user to confirm
  const handleAnalyze = async () => {
    if (!logs?.pipelineIdentifier) return;
    setAnalyzing(true);
    setFixError("");
    setAnalysis(null);
    setFixYaml("");
    setFixDiff([]);
    setSaveMsg("");
    try {
      const detail = await getPipelineDetail(config, credentials.orgId, credentials.projectId, logs.pipelineIdentifier);
      setOriginalYaml(detail.yaml);
      const errorContext = [
        logs.errorMessage,
        ...logs.failed_nodes.map(n => `Step "${n.name}" (${n.type || ""}): ${n.errorMessage || n.failureInfo || ""}`),
      ].filter(Boolean).join("\n");
      const result = await aiAnalyzePipeline(config, detail.yaml, errorContext);
      setAnalysis(result);
    } catch (e: any) {
      setFixError(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 2 — Apply: user confirmed, now do the surgical fix
  const handleApplyFix = async () => {
    if (!analysis || !originalYaml) return;
    setApplyingFix(true);
    setFixError("");
    try {
      const instruction = `This is a ${analysis.pipeline_type} pipeline. Fix ONLY the step "${analysis.failing_step}" (identifier: ${analysis.failing_step_identifier}).
Root cause: ${analysis.root_cause}
Apply ONLY these changes:
${analysis.proposed_changes.map(c => `- In field "${c.field}": change "${c.current_value}" to "${c.proposed_value}"`).join("\n")}
Do NOT change anything else in the pipeline.`;
      const result = await aiEditPipeline(config, originalYaml, instruction);
      setFixYaml(result.yaml);
      // Compute diff
      const oldLines = originalYaml.split("\n");
      const newLines = result.yaml.split("\n");
      const changes: { line: number; old: string; new: string }[] = [];
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        const o = oldLines[i] ?? "";
        const n = newLines[i] ?? "";
        if (o !== n) changes.push({ line: i + 1, old: o, new: n });
      }
      setFixDiff(changes);
    } catch (e: any) {
      setFixError(e.message || "Failed to apply fix");
    } finally {
      setApplyingFix(false);
    }
  };

  const handleSaveFixedYaml = async () => {
    if (!logs?.pipelineIdentifier || !fixYaml) return;
    setSavingYaml(true);
    setSaveMsg("");
    try {
      await updatePipeline(config, credentials.orgId, credentials.projectId, logs.pipelineIdentifier, fixYaml);
      setSaveMsg("Pipeline YAML updated successfully.");
      setOriginalYaml(fixYaml);
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e.message}`);
    } finally {
      setSavingYaml(false);
    }
  };

  const toggleStage = (id: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canSummarize = logs && (logs.status?.toUpperCase() === "FAILED" || logs.failed_nodes.length > 0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Execution Logs</h2>
        <p className="text-sm text-muted-foreground">
          View pipeline execution details and diagnose failures with AI
        </p>
      </div>

      {/* Execution ID input */}
      <div className="flex gap-2">
        <Input
          placeholder="Execution ID (planExecutionId)"
          value={inputId}
          onChange={e => setInputId(e.target.value)}
          className="max-w-md font-mono text-sm"
          onKeyDown={e => e.key === "Enter" && setExecutionId(inputId)}
        />
        <Button
          onClick={() => setExecutionId(inputId)}
          disabled={!inputId.trim() || loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load Logs"}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 p-3 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {logs && !loading && (
        <div className="space-y-4">
          {/* Execution summary header */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{logs.pipelineName}</h3>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className={`font-medium ${statusColor(logs.status)}`}>{logs.status}</span>
                  <span>Started: {fmt(logs.startTs)}</span>
                  <span>Duration: {calcDuration(logs.startTs, logs.endTs)}</span>
                  {logs.triggerType && <span>Trigger: {logs.triggerType}</span>}
                  {logs.triggeredBy && <span>By: {logs.triggeredBy}</span>}
                </div>
                {logs.errorMessage && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {logs.errorMessage}
                  </div>
                )}
              </div>
              {canSummarize && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSummarize} disabled={summarizing}>
                    {summarizing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                    {summarizing ? "Analyzing..." : "AI Summary"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing || applyingFix}>
                    {analyzing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wrench className="w-3.5 h-3.5 mr-1" />}
                    {analyzing ? "Analyzing..." : "Analyze & Fix"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* AI Summary */}
          {summary && (
            <div className="border rounded-lg p-4 bg-blue-50/50 border-blue-100">
              <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5" /> AI Failure Analysis
              </h4>
              <div className="text-sm text-blue-900 whitespace-pre-wrap">{summary}</div>
            </div>
          )}

          {/* Step 1 — Analysis proposal */}
          {analysis && !fixYaml && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-orange-50 border-b border-orange-200">
                <div className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-sm font-semibold text-orange-800">AI Proposed Fix</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-mono">{analysis.pipeline_type} Pipeline</span>
                </div>
                <button onClick={() => setAnalysis(null)} className="text-xs text-orange-500 hover:text-orange-800">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Failing Step</span>
                  <p className="text-sm font-mono mt-0.5">{analysis.failing_step} <span className="text-muted-foreground text-xs">({analysis.failing_step_identifier})</span></p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Root Cause</span>
                  <p className="text-sm mt-0.5 text-red-700">{analysis.root_cause}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Proposed Changes</span>
                  <div className="mt-1 space-y-2">
                    {analysis.proposed_changes.map((c, i) => (
                      <div key={i} className="border rounded p-2 text-xs space-y-1">
                        <div className="font-mono text-muted-foreground">Field: <span className="text-foreground">{c.field}</span></div>
                        <div className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono">- {c.current_value}</div>
                        <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">+ {c.proposed_value}</div>
                        <div className="text-muted-foreground italic">{c.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleApplyFix} disabled={applyingFix}>
                    {applyingFix ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wrench className="w-3.5 h-3.5 mr-1" />}
                    {applyingFix ? "Applying..." : "Apply This Fix"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          {/* Fix YAML panel */}
          {fixError && (
            <div className="text-sm text-red-600 p-3 bg-red-50 rounded border border-red-200">{fixError}</div>
          )}
          {fixYaml && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> AI-Fixed Pipeline YAML
                </h4>
                <div className="flex items-center gap-2">
                  {saveMsg && (
                    <span className={`text-xs ${saveMsg.startsWith("Save failed") ? "text-red-600" : "text-green-600"}`}>
                      {saveMsg}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFixYaml(originalYaml); setSaveMsg(""); }}
                    title="Revert to original"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                  </Button>
                  <Button size="sm" onClick={handleSaveFixedYaml} disabled={savingYaml}>
                    {savingYaml ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    {savingYaml ? "Saving..." : "Save to Harness"}
                  </Button>
                </div>
              </div>

              {/* Diff panel */}
              {fixDiff.length > 0 && (
                <div className="border-b">
                  <div className="flex items-center justify-between px-4 py-1.5 bg-yellow-50 border-b border-yellow-200">
                    <span className="text-xs font-medium text-yellow-800">
                      {fixDiff.length} line{fixDiff.length > 1 ? "s" : ""} changed by AI
                    </span>
                    <button onClick={() => setFixDiff([])} className="text-xs text-yellow-600 hover:text-yellow-900">✕ dismiss</button>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-muted bg-muted/10">
                    {fixDiff.map(d => (
                      <div key={d.line} className="px-4 py-1.5 font-mono text-xs">
                        <span className="text-muted-foreground text-[10px] mr-2">Line {d.line}</span>
                        {d.old && <div className="bg-red-50 text-red-700 px-2 py-0.5 rounded mb-0.5 whitespace-pre-wrap break-all">- {d.old}</div>}
                        {d.new && <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded whitespace-pre-wrap break-all">+ {d.new}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                className="w-full font-mono text-xs p-4 bg-background resize-none focus:outline-none"
                rows={24}
                value={fixYaml}
                onChange={e => setFixYaml(e.target.value)}
              />
            </div>
          )}

          {/* Failed steps — shown first for quick visibility */}
          {logs.failed_nodes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-red-600">
                Failed Steps ({logs.failed_nodes.length})
              </h4>
              <div className="border border-red-200 rounded-lg overflow-hidden divide-y divide-red-100">
                {logs.failed_nodes.map((node, i) => (
                  <div key={i} className="px-4 py-3 bg-red-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm font-medium">{node.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{node.type}</span>
                      <span className="text-xs text-red-500">{node.status}</span>
                    </div>
                    {node.errorMessage && (
                      <div className="ml-6 text-xs text-red-700 font-mono bg-red-100 px-2 py-1.5 rounded mt-1">
                        {node.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stages */}
          {logs.stages.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Stages ({logs.stages.length})
              </h4>
              <div className="border rounded-lg overflow-hidden divide-y">
                {logs.stages.map(stage => (
                  <div key={stage.identifier}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => toggleStage(stage.identifier)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedStages.has(stage.identifier) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{stage.name}</span>
                        <span className={`text-xs font-medium ${statusColor(stage.status)}`}>
                          {stage.status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {calcDuration(stage.startTs, stage.endTs)}
                      </span>
                    </button>
                    {expandedStages.has(stage.identifier) && stage.errorMessage && (
                      <div className="px-10 pb-3">
                        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded font-mono border border-red-100">
                          {stage.errorMessage}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!logs && !loading && !error && (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Enter an execution ID above, or click any row in Deployments to load logs here
        </div>
      )}
    </div>
  );
}
