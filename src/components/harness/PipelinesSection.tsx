import { useEffect, useState } from "react";
import { Loader2, Save, Wand2, RotateCcw, Clock, Tag, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listPipelines,
  getPipelineDetail,
  updatePipeline,
  aiEditPipeline,
  getPipelineTriggers,
  getPipelineInputSets,
  getTriggerDetail,
  getInputSetDetail,
  buildConfig,
  type HarnessCredentials,
  type HarnessPipeline,
  type PipelineTrigger,
  type PipelineInputSet,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
}

export default function PipelinesSection({ credentials }: Props) {
  const config = buildConfig(credentials.apiKey);

  const [pipelines, setPipelines] = useState<HarnessPipeline[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [yaml, setYaml] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");

  const [instruction, setInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diffLines, setDiffLines] = useState<{ line: number; old: string; new: string }[]>([]);

  const [activeTab, setActiveTab] = useState<"yaml" | "triggers" | "inputsets">("yaml");
  const [triggers, setTriggers] = useState<PipelineTrigger[]>([]);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [inputSets, setInputSets] = useState<PipelineInputSet[]>([]);
  const [inputSetsLoading, setInputSetsLoading] = useState(false);
  const [expandedTrigger, setExpandedTrigger] = useState<string>("");
  const [triggerYaml, setTriggerYaml] = useState<Record<string, string>>({});
  const [triggerYamlLoading, setTriggerYamlLoading] = useState<string>("");
  const [expandedInputSet, setExpandedInputSet] = useState<string>("");
  const [inputSetYaml, setInputSetYaml] = useState<Record<string, string>>({});
  const [inputSetYamlLoading, setInputSetYamlLoading] = useState<string>("");

  useEffect(() => {
    listPipelines(config, credentials.orgId, credentials.projectId)
      .then(setPipelines)
      .catch(e => setListError(e.message || "Failed to load pipelines"))
      .finally(() => setLoadingList(false));
  }, [credentials]);

  const handleSelect = async (pipelineId: string) => {
    setSelectedId(pipelineId);
    setYaml("");
    setOriginalYaml("");
    setMessage(null);
    setTriggers([]);
    setInputSets([]);
    setActiveTab("yaml");
    setExpandedTrigger("");
    setTriggerYaml({});
    setExpandedInputSet("");
    setInputSetYaml({});
    setDiffLines([]);
    if (!pipelineId) return;

    setLoadingDetail(true);
    getPipelineDetail(config, credentials.orgId, credentials.projectId, pipelineId)
      .then(detail => { setYaml(detail.yaml || ""); setOriginalYaml(detail.yaml || ""); })
      .catch(e => setMessage({ type: "error", text: e.message }))
      .finally(() => setLoadingDetail(false));

    setTriggersLoading(true);
    getPipelineTriggers(config, credentials.orgId, credentials.projectId, pipelineId)
      .then(res => setTriggers(res.triggers || []))
      .catch(() => setTriggers([]))
      .finally(() => setTriggersLoading(false));

    setInputSetsLoading(true);
    getPipelineInputSets(config, credentials.orgId, credentials.projectId, pipelineId)
      .then(res => setInputSets(res.inputSets || []))
      .catch(() => setInputSets([]))
      .finally(() => setInputSetsLoading(false));
  };

  const handleAiEdit = async () => {
    if (!instruction.trim() || !yaml) return;
    setAiLoading(true);
    setMessage(null);
    setDiffLines([]);
    try {
      const result = await aiEditPipeline(config, yaml, instruction);
      // Compute line-by-line diff
      const oldLines = yaml.split("\n");
      const newLines = result.yaml.split("\n");
      const changes: { line: number; old: string; new: string }[] = [];
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        const o = oldLines[i] ?? "";
        const n = newLines[i] ?? "";
        if (o !== n) changes.push({ line: i + 1, old: o, new: n });
      }
      setDiffLines(changes);
      setYaml(result.yaml);
      setInstruction("");
    } catch (e: any) {
      setMessage({ type: "error", text: `AI edit failed: ${e.message}` });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updatePipeline(config, credentials.orgId, credentials.projectId, selectedId, yaml);
      setOriginalYaml(yaml);
      setMessage({ type: "success", text: "Pipeline saved to Harness successfully." });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const isDirty = yaml !== originalYaml;

  const quickInstructions = [
    "Add an approval step before the deploy stage",
    "Add a Slack notification on failure",
    "Change the timeout to 30 minutes",
    "Add a rollback on failure",
  ];

  return (
    <div className="flex h-full" style={{ minHeight: "calc(100vh - 64px)" }}>
      {/* Pipeline list */}
      <div className="w-56 border-r flex flex-col flex-shrink-0 bg-muted/10">
        <div className="p-3 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pipelines
          </h3>
        </div>
        {loadingList ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : listError ? (
          <div className="p-3 text-xs text-red-600">{listError}</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {pipelines.map(p => {
              const lastStatus = p.executionSummaryInfo?.lastExecutionStatus?.toUpperCase();
              const statusColor = lastStatus === "SUCCESS" ? "bg-green-100 text-green-700"
                : lastStatus === "FAILED" ? "bg-red-100 text-red-700"
                : lastStatus === "RUNNING" ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-500";
              return (
                <button
                  key={p.identifier}
                  onClick={() => handleSelect(p.identifier)}
                  className={`w-full text-left px-3 py-2.5 text-sm border-b hover:bg-muted/40 transition-colors ${
                    selectedId === p.identifier ? "bg-muted font-medium" : ""
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground truncate font-mono">{p.identifier}</span>
                    {lastStatus && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1 flex-shrink-0 ${statusColor}`}>
                        {lastStatus === "SUCCESS" ? "✓" : lastStatus === "FAILED" ? "✗" : "●"} {lastStatus}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {pipelines.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No pipelines found</div>
            )}
          </div>
        )}
      </div>

      {/* YAML editor + AI panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
            Select a pipeline from the list to view and edit its YAML
          </div>
        ) : loadingDetail ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 flex-shrink-0">
              <span className="text-sm font-medium">
                {pipelines.find(p => p.identifier === selectedId)?.name}
                {isDirty && (
                  <span className="ml-2 text-xs text-orange-500 font-normal">● unsaved changes</span>
                )}
              </span>
              <div className="flex gap-2">
                {isDirty && (
                  <Button variant="ghost" size="sm" onClick={() => setYaml(originalYaml)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1" />
                  )}
                  {saving ? "Saving..." : "Save to Harness"}
                </Button>
              </div>
            </div>

            {/* Metadata strip — uses list data which includes createdAt/lastUpdatedAt */}
            {(() => {
              const p = pipelines.find(p => p.identifier === selectedId);
              if (!p) return null;
              return (
                <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b bg-muted/10 text-xs text-muted-foreground">
                  {p.storeType && (
                    <span>Store: <span className="font-mono text-foreground">{p.storeType}</span></span>
                  )}
                  {p.createdAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: <span className="text-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </span>
                  )}
                  {p.lastUpdatedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Modified: <span className="text-foreground">{new Date(p.lastUpdatedAt).toLocaleString()}</span>
                    </span>
                  )}
                  {p.tags && Object.keys(p.tags).length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {Object.entries(p.tags).map(([k, v]) => (
                        <span key={k} className="bg-muted text-foreground px-1.5 py-0.5 rounded font-mono">
                          {k}{v ? `: ${v}` : ""}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })()}

            {message && (
              <div
                className={`mx-4 mt-3 p-2 rounded text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b px-4 gap-0 flex-shrink-0">
              {[
                { id: "yaml", label: "YAML" },
                { id: "triggers", label: `Triggers${triggersLoading ? "" : triggers.length ? ` (${triggers.length})` : ""}` },
                { id: "inputsets", label: `Input Sets${inputSetsLoading ? "" : inputSets.length ? ` (${inputSets.length})` : ""}` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {(tab.id === "triggers" && triggersLoading) || (tab.id === "inputsets" && inputSetsLoading)
                    ? <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
                    : null}
                </button>
              ))}
            </div>

            {/* YAML + AI side panel */}
            <div className={`flex flex-1 overflow-hidden ${activeTab !== "yaml" ? "hidden" : ""}`}>
              {/* YAML textarea */}
              <div className="flex-1 overflow-auto p-4">
                <textarea
                  className="w-full h-full font-mono text-xs border rounded p-3 resize-none bg-muted/10 focus:outline-none focus:ring-1 focus:ring-primary"
                  value={yaml}
                  onChange={e => setYaml(e.target.value)}
                  spellCheck={false}
                  style={{ minHeight: "500px" }}
                />
              </div>

              {/* AI edit panel */}
              <div className="w-64 border-l flex flex-col p-4 gap-3 flex-shrink-0">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    AI Edit
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Describe the change you want to make to this pipeline
                  </p>
                </div>

                <textarea
                  className="border rounded p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={4}
                  placeholder="e.g. Add an approval step before the prod deploy stage"
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                />

                <Button
                  size="sm"
                  onClick={handleAiEdit}
                  disabled={!instruction.trim() || aiLoading}
                  className="w-full"
                >
                  {aiLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Editing...</>
                  ) : (
                    <><Wand2 className="w-3.5 h-3.5 mr-1" /> Apply AI Edit</>
                  )}
                </Button>

                <div className="text-xs text-muted-foreground pt-1">
                  <p className="font-medium mb-2">Quick actions:</p>
                  <div className="space-y-1.5">
                    {quickInstructions.map(q => (
                      <button
                        key={q}
                        onClick={() => setInstruction(q)}
                        className="block text-left w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        • {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diff panel */}
                {diffLines.length > 0 && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center justify-between">
                      <span className="text-xs font-medium">{diffLines.length} line{diffLines.length > 1 ? "s" : ""} changed</span>
                      <button onClick={() => setDiffLines([])} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y">
                      {diffLines.map(d => (
                        <div key={d.line} className="px-3 py-1.5 text-xs font-mono">
                          <div className="text-muted-foreground mb-0.5">Line {d.line}</div>
                          {d.old && <div className="bg-red-50 text-red-700 px-2 py-0.5 rounded mb-0.5 whitespace-pre-wrap break-all">- {d.old}</div>}
                          {d.new && <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded whitespace-pre-wrap break-all">+ {d.new}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Triggers tab */}
            {activeTab === "triggers" && (
              <div className="flex-1 overflow-auto p-4">
                {triggersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading triggers...
                  </div>
                ) : triggers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No triggers configured for this pipeline.</p>
                ) : (
                  <div className="space-y-3">
                    {triggers.map(t => (
                      <div key={t.identifier} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t.name}</span>
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted">{t.type}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {t.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{t.identifier}</span>
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={async () => {
                                if (expandedTrigger === t.identifier) {
                                  setExpandedTrigger("");
                                  return;
                                }
                                setExpandedTrigger(t.identifier);
                                if (!triggerYaml[t.identifier]) {
                                  setTriggerYamlLoading(t.identifier);
                                  try {
                                    const res = await getTriggerDetail(config, credentials.orgId, credentials.projectId, selectedId, t.identifier);
                                    setTriggerYaml(prev => ({ ...prev, [t.identifier]: res.yaml || "# No YAML available" }));
                                  } catch {
                                    setTriggerYaml(prev => ({ ...prev, [t.identifier]: "# Failed to load trigger YAML" }));
                                  } finally {
                                    setTriggerYamlLoading("");
                                  }
                                }
                              }}
                            >
                              {expandedTrigger === t.identifier ? "Hide YAML" : "View YAML"}
                            </button>
                          </div>
                        </div>
                        {t.webhookUrl && (
                          <div className="px-4 py-2 text-xs border-b">
                            <span className="text-muted-foreground">Webhook URL: </span>
                            <span className="font-mono text-foreground break-all">{t.webhookUrl}</span>
                          </div>
                        )}
                        {expandedTrigger === t.identifier && (
                          <div className="px-4 py-3">
                            {triggerYamlLoading === t.identifier ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading YAML...
                              </div>
                            ) : (
                              <pre className="text-xs font-mono bg-muted/30 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                                {triggerYaml[t.identifier]}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input Sets tab */}
            {activeTab === "inputsets" && (
              <div className="flex-1 overflow-auto p-4">
                {inputSetsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading input sets...
                  </div>
                ) : inputSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No input sets configured for this pipeline.</p>
                ) : (
                  <div className="space-y-3">
                    {inputSets.map(is => (
                      <div key={is.identifier} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{is.name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
                              {is.inputSetType === "OVERLAY_INPUT_SET" ? "Overlay" : "Input Set"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{is.identifier}</span>
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={async () => {
                                if (expandedInputSet === is.identifier) {
                                  setExpandedInputSet("");
                                  return;
                                }
                                setExpandedInputSet(is.identifier);
                                if (!inputSetYaml[is.identifier]) {
                                  setInputSetYamlLoading(is.identifier);
                                  try {
                                    const res = await getInputSetDetail(config, credentials.orgId, credentials.projectId, selectedId, is.identifier);
                                    setInputSetYaml(prev => ({ ...prev, [is.identifier]: res.yaml || "# No YAML available" }));
                                  } catch {
                                    setInputSetYaml(prev => ({ ...prev, [is.identifier]: "# Failed to load input set YAML" }));
                                  } finally {
                                    setInputSetYamlLoading("");
                                  }
                                }
                              }}
                            >
                              {expandedInputSet === is.identifier ? "Hide YAML" : "View YAML"}
                            </button>
                          </div>
                        </div>
                        {is.description && (
                          <div className="px-4 py-2 text-xs text-muted-foreground border-b">{is.description}</div>
                        )}
                        {expandedInputSet === is.identifier && (
                          <div className="px-4 py-3">
                            {inputSetYamlLoading === is.identifier ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading YAML...
                              </div>
                            ) : (
                              <pre className="text-xs font-mono bg-muted/30 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                                {inputSetYaml[is.identifier]}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
