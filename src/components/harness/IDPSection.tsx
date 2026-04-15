import { useEffect, useState } from "react";
import { Loader2, RefreshCw, BookOpen, BarChart2, Zap, ExternalLink, Tag, User, Layers, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  idpListCatalog,
  idpListScorecards,
  idpListWorkflows,
  buildConfig,
  type HarnessCredentials,
  type IdpEntity,
  type IdpScorecard,
  type IdpWorkflow,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
}

type Tab = "catalog" | "scorecards" | "workflows";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "catalog", label: "Catalog", icon: BookOpen },
  { id: "scorecards", label: "Scorecards", icon: BarChart2 },
  { id: "workflows", label: "Workflows", icon: Zap },
];

function kindColor(kind: string) {
  const k = kind?.toLowerCase();
  if (k === "component" || k === "service") return "bg-blue-100 text-blue-700";
  if (k === "api") return "bg-purple-100 text-purple-700";
  if (k === "template") return "bg-orange-100 text-orange-700";
  if (k === "system") return "bg-green-100 text-green-700";
  if (k === "group") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

function lifecycleColor(lc?: string) {
  if (lc === "production") return "text-green-600";
  if (lc === "experimental") return "text-yellow-600";
  if (lc === "deprecated") return "text-red-500";
  return "text-muted-foreground";
}

function ScoreBar({ score, max }: { score?: number; max?: number }) {
  if (score == null) return null;
  const pct = max ? Math.round((score / max) * 100) : score;
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function IDPSection({ credentials }: Props) {
  const config = buildConfig(credentials.apiKey);
  const [activeTab, setActiveTab] = useState<Tab>("catalog");

  const [entities, setEntities] = useState<IdpEntity[]>([]);
  const [scorecards, setScorecards] = useState<IdpScorecard[]>([]);
  const [workflows, setWorkflows] = useState<IdpWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const load = async (tab: Tab, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    setApiError("");
    try {
      if (tab === "catalog") {
        const res = await idpListCatalog(config);
        setEntities(res.entities || []);
        if (res.error) setApiError(res.error);
      } else if (tab === "scorecards") {
        const res = await idpListScorecards(config);
        setScorecards(res.scorecards || []);
        if (res.error) setApiError(res.error);
      } else {
        const res = await idpListWorkflows(config);
        setWorkflows(res.workflows || []);
        if (res.error) setApiError(res.error);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(activeTab); }, [activeTab, credentials]);

  // Unique kinds for filter
  const kinds = ["all", ...Array.from(new Set(entities.map(e => e.kind).filter(Boolean)))];

  const filtered = entities.filter(e => {
    const name = e.metadata?.name?.toLowerCase() || "";
    const desc = e.metadata?.description?.toLowerCase() || "";
    const matchSearch = !search || name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchKind = kindFilter === "all" || e.kind === kindFilter;
    return matchSearch && matchKind;
  });

  const idpPortalUrl = `https://app.harness.io/ng/account/${credentials.accountId || ""}/module/idp`;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Internal Developer Portal</h2>
          <p className="text-sm text-muted-foreground">Software catalog, scorecards & self-service workflows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(activeTab)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <a href={idpPortalUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open IDP
            </Button>
          </a>
        </div>
      </div>

      {/* Tabs — only shown when IDP is reachable */}
      {!apiError && (
        <div className="flex border-b border-border">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : apiError ? (
        /* IDP not enabled — show setup guide */
        <div className="flex flex-col items-center justify-center py-16 px-8 gap-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Library className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-base">Harness IDP is not enabled on this account</h3>
            <p className="text-sm text-muted-foreground">
              The Internal Developer Portal (IDP) is a separate Harness module. Once enabled, you'll see your software
              catalog, scorecards, and self-service workflows here.
            </p>
          </div>
          <div className="w-full border rounded-lg divide-y text-sm">
            <div className="px-4 py-3 flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 font-medium">1</span>
              <div>
                <div className="font-medium">Enable IDP on your account</div>
                <div className="text-muted-foreground text-xs mt-0.5">Go to Account Settings → Subscriptions → enable Internal Developer Portal</div>
              </div>
            </div>
            <div className="px-4 py-3 flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 font-medium">2</span>
              <div>
                <div className="font-medium">Register your services in the Catalog</div>
                <div className="text-muted-foreground text-xs mt-0.5">Add a <code className="bg-muted px-1 rounded">catalog-info.yaml</code> to each repo and register it in IDP</div>
              </div>
            </div>
            <div className="px-4 py-3 flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 font-medium">3</span>
              <div>
                <div className="font-medium">Create scorecards & workflows</div>
                <div className="text-muted-foreground text-xs mt-0.5">Define health checks and self-service actions — they'll appear here automatically</div>
              </div>
            </div>
          </div>
          <a href={idpPortalUrl} target="_blank" rel="noopener noreferrer">
            <Button>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Harness IDP
            </Button>
          </a>
        </div>
      ) : (
        <>
          {/* ── CATALOG TAB ─────────────────────────────────────────────── */}
          {activeTab === "catalog" && (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex gap-2">
                <input
                  className="border rounded px-3 py-1.5 text-sm bg-background flex-1 max-w-xs"
                  placeholder="Search by name or description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="border rounded px-3 py-1.5 text-sm bg-background"
                  value={kindFilter}
                  onChange={e => setKindFilter(e.target.value)}
                >
                  {kinds.map(k => (
                    <option key={k} value={k}>{k === "all" ? "All kinds" : k}</option>
                  ))}
                </select>
              </div>

              {filtered.length === 0 && !apiError ? (
                <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>No catalog entities found.</p>
                  <p className="text-xs">Register services in the{" "}
                    <a href={idpPortalUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                      Harness IDP
                    </a>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filtered.map((entity, i) => (
                    <div key={i} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindColor(entity.kind)}`}>
                              {entity.kind}
                            </span>
                            {entity.spec?.type && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {entity.spec.type}
                              </span>
                            )}
                            {entity.spec?.lifecycle && (
                              <span className={`text-xs font-medium ${lifecycleColor(entity.spec.lifecycle)}`}>
                                {entity.spec.lifecycle}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-sm mt-1">{entity.metadata?.name}</h3>
                          {entity.metadata?.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {entity.metadata.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {entity.spec?.owner && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="w-3 h-3" /> {entity.spec.owner}
                              </span>
                            )}
                            {entity.spec?.system && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Layers className="w-3 h-3" /> {entity.spec.system}
                              </span>
                            )}
                            {entity.metadata?.tags?.slice(0, 3).map(tag => (
                              <span key={tag} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Tag className="w-3 h-3" /> {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        {entity.metadata?.links?.[0] && (
                          <a
                            href={entity.metadata.links[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SCORECARDS TAB ──────────────────────────────────────────── */}
          {activeTab === "scorecards" && (
            <div className="space-y-3">
              {scorecards.length === 0 && !apiError ? (
                <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground gap-2">
                  <BarChart2 className="w-8 h-8 opacity-30" />
                  <p>No scorecards found.</p>
                  <p className="text-xs">Create scorecards in{" "}
                    <a href={idpPortalUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                      Harness IDP
                    </a>.
                  </p>
                </div>
              ) : (
                scorecards.map((sc, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{sc.name}</h3>
                      {sc.components != null && (
                        <span className="text-xs text-muted-foreground">{sc.components} components</span>
                      )}
                    </div>
                    {sc.description && (
                      <p className="text-xs text-muted-foreground">{sc.description}</p>
                    )}
                    <ScoreBar score={sc.totalScore} max={sc.maxScore} />
                    {sc.checks && sc.checks.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {sc.checks.map((c, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <span className={c.passing ? "text-green-500" : "text-red-500"}>
                              {c.passing ? "✓" : "✗"}
                            </span>
                            <span className={c.passing ? "text-foreground" : "text-muted-foreground"}>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── WORKFLOWS TAB ────────────────────────────────────────────── */}
          {activeTab === "workflows" && (
            <div className="space-y-3">
              {workflows.length === 0 && !apiError ? (
                <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground gap-2">
                  <Zap className="w-8 h-8 opacity-30" />
                  <p>No workflows found.</p>
                  <p className="text-xs">Create self-service workflows in{" "}
                    <a href={idpPortalUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                      Harness IDP
                    </a>.
                  </p>
                </div>
              ) : (
                workflows.map((wf, i) => {
                  const name = wf.title || wf.name || wf.metadata?.name || "Unnamed";
                  const desc = wf.description || wf.metadata?.description || "";
                  const tags = wf.metadata?.tags || [];
                  const type = wf.spec?.type || wf.kind || "";
                  return (
                    <div key={i} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-orange-500" />
                            <h3 className="font-medium text-sm">{name}</h3>
                            {type && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                {type}
                              </span>
                            )}
                          </div>
                          {desc && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>}
                          {tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {tags.slice(0, 4).map(t => (
                                <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <a
                          href={`${idpPortalUrl}/create`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="ml-3 flex-shrink-0">
                            <Zap className="w-3 h-3 mr-1" /> Run
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
