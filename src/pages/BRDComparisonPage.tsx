import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  GitCompareArrows,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { API_CONFIG } from "@/config/api";
import { apiGet } from "@/services/api";
import {
  compareBrdWithCodeSummary,
  applyApprovedChanges,
  type Suggestion,
  type ChangeType,
} from "@/services/brdComparisonApi";
import type { CodeSummaryPage } from "@/services/brdSyncApi";

interface NavState {
  projectId: string;
  spaceKey: string;
  codeSummary: CodeSummaryPage;
}

interface SpacePage {
  id: string;
  title: string;
}

type Step = "pick" | "comparing" | "review" | "applying" | "done";
type TabKey = "all" | "MODIFY" | "ADD" | "REMOVE";

const CHANGE_META: Record<
  ChangeType,
  { label: string; Icon: typeof Plus; chip: string; row: string }
> = {
  ADD:    { label: "Add",    Icon: Plus,   chip: "ci-chip ci-chip--add", row: "ci-row ci-row--add" },
  MODIFY: { label: "Modify", Icon: Pencil, chip: "ci-chip ci-chip--mod", row: "ci-row ci-row--mod" },
  REMOVE: { label: "Remove", Icon: Trash2, chip: "ci-chip ci-chip--rem", row: "ci-row ci-row--rem" },
};

const STEPS: { key: Step; label: string }[] = [
  { key: "pick",      label: "Select"  },
  { key: "comparing", label: "Scan"    },
  { key: "review",    label: "Review"  },
  { key: "applying",  label: "Commit"  },
  { key: "done",      label: "Done"    },
];

const BRDComparisonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as NavState | null;

  useEffect(() => {
    if (!state?.codeSummary || !state?.projectId || !state?.spaceKey) {
      navigate("/brd-sync", { replace: true });
    }
  }, [state, navigate]);

  if (!state?.codeSummary || !state?.projectId || !state?.spaceKey) return null;

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="brd-sync" showBackButton onBack={() => navigate("/brd-sync")}>
        <ComparisonFlow
          projectId={state.projectId}
          spaceKey={state.spaceKey}
          codeSummary={state.codeSummary}
        />
      </MainLayout>
    </div>
  );
};

const ComparisonFlow = ({
  projectId,
  spaceKey,
  codeSummary,
}: {
  projectId: string;
  spaceKey: string;
  codeSummary: CodeSummaryPage;
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pick");

  const [pages, setPages] = useState<SpacePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState<SpacePage | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const [applyResult, setApplyResult] = useState<{
    web_url: string;
    title: string;
    applied: number;
  } | null>(null);

  useEffect(() => {
    setPagesLoading(true);
    setPagesError(null);
    const url = `${API_CONFIG.BASE_URL}/api/integrations/confluence/pages?space_key=${encodeURIComponent(
      spaceKey,
    )}&limit=500`;
    apiGet(url)
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`Failed to load pages (${resp.status})`);
        const data = await resp.json();
        const raw: Array<{ id: string; title: string }> = data.results || [];
        setPages(
          raw
            .filter((p) => p.id !== codeSummary.page_id)
            .map((p) => ({ id: p.id, title: p.title })),
        );
      })
      .catch((e) => setPagesError(e?.message || "Failed to load pages"))
      .finally(() => setPagesLoading(false));
  }, [spaceKey, codeSummary.page_id]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, search]);

  const counts = useMemo(() => {
    const c: Record<ChangeType, number> = { ADD: 0, MODIFY: 0, REMOVE: 0 };
    for (const s of suggestions) c[s.change_type]++;
    return c;
  }, [suggestions]);

  const visibleSuggestions = useMemo(() => {
    if (activeTab === "all") return suggestions;
    return suggestions.filter((s) => s.change_type === activeTab);
  }, [suggestions, activeTab]);

  const handleCompare = async () => {
    if (!selectedPage) return;
    setStep("comparing");
    try {
      const result = await compareBrdWithCodeSummary(projectId, codeSummary.page_id, selectedPage.id);
      setSuggestions(result.suggestions);
      setApprovedIds(new Set(result.suggestions.map((s) => s.id)));
      setExpandedIds(new Set());
      setActiveTab("all");
      setStep("review");
      if (result.suggestions.length === 0) {
        toast.info("No mismatches found — this BRD already agrees with the code summary.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Comparison failed");
      setStep("pick");
    }
  };

  const handleApply = async () => {
    if (!selectedPage) return;
    const approved = suggestions.filter((s) => approvedIds.has(s.id));
    if (approved.length === 0) {
      toast.error("Pick at least one change to apply.");
      return;
    }
    setStep("applying");
    try {
      const result = await applyApprovedChanges(projectId, codeSummary.page_id, selectedPage.id, approved);
      setApplyResult({ web_url: result.web_url, title: result.title, applied: result.applied });
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message || "Apply failed");
      setStep("review");
    }
  };

  const toggleApproved = (id: string) =>
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const approvedCount = approvedIds.size;
  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="mb-8 usage-rise">
        <button
          onClick={() => navigate("/brd-sync")}
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          BRD Sync
        </button>

        <div className="usage-section-mark mb-3">
          <GitCompareArrows className="h-3.5 w-3.5 text-primary" />
          <span className="usage-section-num">02</span>
          <span>Comparison Agent</span>
        </div>
        <h1 className="usage-num-display text-[2.4rem] leading-[1.05] font-bold text-foreground">
          Reconcile a BRD with this code summary
        </h1>
        <div className="usage-baseline-rule mt-3 max-w-[55%]" />
        <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          Pick a BRD page from your space, run the diff agent, and approve the proposed{" "}
          <span className="font-semibold text-foreground">add / modify / remove</span> changes.
          The Confluence page updates in place.
        </p>
      </header>

      {/* ── Dual-document indicator ─────────────────────────────────── */}
      <div className="ci-dual-doc mb-6 usage-rise">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary mb-1.5">
            Source · code summary
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {codeSummary.title}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground font-mono">
            v{codeSummary.version}
          </div>
        </div>

        <span className="ci-dual-doc__arrow" aria-hidden>
          <GitCompareArrows className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary mb-1.5">
            Target · BRD
          </div>
          {selectedPage ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">
                  {selectedPage.title}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground font-mono">locked</div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground italic">— awaiting selection —</div>
              <div className="mt-1 text-[11px] text-muted-foreground font-mono">no target</div>
            </>
          )}
        </div>
      </div>

      {/* ── Stepper ─────────────────────────────────────────────────── */}
      <div className="mb-10 usage-rise px-4">
        <div
          className="ci-stepper"
          role="list"
          aria-label="Comparison agent progress"
        >
          {/* Rail (background track) */}
          <span className="ci-stepper__rail" aria-hidden />

          {/* Rail fill — width derives from currentStepIdx so the
              progress bar animates as the active step advances.
              Nodes sit at fractional positions (i / (n-1)) of the
              rail, so the fill width is currentStepIdx / (n-1). */}
          <span
            className="ci-stepper__rail-fill"
            aria-hidden
            style={{
              width:
                currentStepIdx <= 0
                  ? "0%"
                  : `${(Math.min(currentStepIdx, STEPS.length - 1) / (STEPS.length - 1)) * 100}%`,
            }}
          />

          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = i < currentStepIdx;
            const state = isActive ? "active" : isDone ? "done" : "pending";
            return (
              <div
                key={s.key}
                role="listitem"
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "ci-step",
                  isActive && "ci-step--active",
                  isDone && "ci-step--done",
                  !isActive && !isDone && "ci-step--pending",
                )}
                data-state={state}
              >
                <span className="ci-step__node">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ci-step__label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP: pick ──────────────────────────────────────────────── */}
      {step === "pick" && (
        <Card className="usage-card-soft p-6 usage-rise">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Pick a BRD to compare against
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {pages.length} pages
            </span>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages in this space…"
              className="pl-9"
            />
          </div>

          <div className="border border-border rounded-lg max-h-[440px] overflow-y-auto bg-card">
            {pagesLoading && (
              <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <div className="ci-scan"><i /><i /><i /><i /><i /></div>
                Indexing pages…
              </div>
            )}
            {!pagesLoading && pagesError && (
              <div className="m-4 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                {pagesError}
              </div>
            )}
            {!pagesLoading && !pagesError && filteredPages.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                {pages.length === 0 ? "No pages in this space." : `No pages match "${search}".`}
              </div>
            )}
            {!pagesLoading && !pagesError && filteredPages.length > 0 && (
              <ul className="divide-y divide-border">
                {filteredPages.map((p) => {
                  const isSelected = selectedPage?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPage(p)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-primary/[0.04] transition-colors flex items-center gap-3",
                          isSelected && "bg-primary/[0.06]",
                        )}
                      >
                        {isSelected && (
                          <span
                            className="w-1 h-6 rounded-full bg-primary flex-shrink-0"
                            aria-hidden
                          />
                        )}
                        <span
                          className={cn(
                            "text-sm truncate",
                            isSelected ? "font-semibold text-foreground" : "text-foreground/80",
                          )}
                        >
                          {p.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => navigate("/brd-sync")}>
              Cancel
            </Button>
            <Button onClick={handleCompare} disabled={!selectedPage}>
              Begin scan
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* ── STEP: comparing ─────────────────────────────────────────── */}
      {step === "comparing" && (
        <Card className="usage-card-soft p-16 text-center usage-corner-brackets usage-rise">
          <div className="flex justify-center mb-5">
            <div className="ci-scan" style={{ height: 56 }}>
              <i /><i /><i /><i /><i />
            </div>
          </div>
          <div className="usage-section-mark justify-center mb-3">
            <span>Agent working</span>
          </div>
          <h2 className="usage-num-display text-2xl font-bold text-foreground">
            Scanning BRD against code summary
          </h2>
          <div className="usage-baseline-rule mt-3 max-w-[40%] mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Walking sections · diffing semantics · staging proposals
          </p>
          <p className="mt-2 text-[11px] font-mono text-muted-foreground tracking-wider">
            Usually 5–15s
          </p>
        </Card>
      )}

      {/* ── STEP: review ────────────────────────────────────────────── */}
      {step === "review" && (
        <section className="space-y-6 usage-rise">
          {/* metric row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricTile tone="total" label="Signals" value={suggestions.length} />
            <MetricTile tone="add"   label="Add"     value={counts.ADD} />
            <MetricTile tone="mod"   label="Modify"  value={counts.MODIFY} />
            <MetricTile tone="rem"   label="Remove"  value={counts.REMOVE} />
          </div>

          {/* control row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex border border-border rounded-lg bg-card overflow-hidden">
              {(["all", "MODIFY", "ADD", "REMOVE"] as TabKey[]).map((k) => {
                const c =
                  k === "all" ? suggestions.length : counts[k as ChangeType];
                const isActive = activeTab === k;
                return (
                  <button
                    key={k}
                    onClick={() => setActiveTab(k)}
                    className={cn(
                      "px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors flex items-center gap-2",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {k === "all" ? "All" : k.charAt(0) + k.slice(1).toLowerCase()}
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums",
                        isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span className="text-primary tabular-nums">{approvedCount}</span>
                <span className="text-muted-foreground"> / {suggestions.length} approved</span>
              </span>
              <Button variant="ghost" onClick={() => setStep("pick")}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </Button>
              <Button onClick={handleApply} disabled={approvedCount === 0}>
                Commit {approvedCount} change{approvedCount === 1 ? "" : "s"}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* suggestion list */}
          <div>
            {visibleSuggestions.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                No suggestions in this category.
              </Card>
            ) : (
              <ul className="space-y-2">
                {visibleSuggestions.map((s, i) => (
                  <SuggestionRow
                    key={s.id}
                    index={i}
                    suggestion={s}
                    checked={approvedIds.has(s.id)}
                    expanded={expandedIds.has(s.id)}
                    onToggleChecked={() => toggleApproved(s.id)}
                    onToggleExpanded={() => toggleExpanded(s.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ── STEP: applying ──────────────────────────────────────────── */}
      {step === "applying" && (
        <Card className="usage-card-soft p-16 text-center usage-corner-brackets usage-rise">
          <div className="flex justify-center mb-5">
            <div className="ci-scan" style={{ height: 56 }}>
              <i /><i /><i /><i /><i />
            </div>
          </div>
          <div className="usage-section-mark justify-center mb-3">
            <span>Agent working</span>
          </div>
          <h2 className="usage-num-display text-2xl font-bold text-foreground">
            Applying changes to your BRD
          </h2>
          <div className="usage-baseline-rule mt-3 max-w-[40%] mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Rewriting the BRD and saving it back to Confluence — please don't refresh.
          </p>
        </Card>
      )}

      {/* ── STEP: done ──────────────────────────────────────────────── */}
      {step === "done" && applyResult && (
        <Card className="usage-card-soft p-12 text-center usage-corner-brackets usage-rise">
          <div className="flex justify-center mb-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </span>
          </div>
          <div className="usage-section-mark justify-center mb-3">
            <span>Sync complete</span>
          </div>
          <h2 className="usage-num-display text-3xl font-bold text-foreground">
            Applied {applyResult.applied} change{applyResult.applied === 1 ? "" : "s"}
          </h2>
          <div className="usage-baseline-rule mt-3 max-w-[40%] mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The BRD is updated in place — downstream readers will see the new spec on their next pull.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Button asChild>
              <a href={applyResult.web_url} target="_blank" rel="noopener noreferrer">
                Open updated BRD
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </Button>
            <Button variant="outline" onClick={() => navigate("/brd-sync")}>
              Back to BRD Sync
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

const MetricTile = ({
  tone,
  label,
  value,
}: {
  tone: "total" | "add" | "mod" | "rem";
  label: string;
  value: number;
}) => (
  <div className={cn("ci-metric", `ci-metric--${tone}`)}>
    <div className="ci-metric__num">{String(value).padStart(2, "0")}</div>
    <div className="ci-metric__rule" />
    <div className="ci-metric__label">{label}</div>
  </div>
);

const SuggestionRow = ({
  index,
  suggestion,
  checked,
  expanded,
  onToggleChecked,
  onToggleExpanded,
}: {
  index: number;
  suggestion: Suggestion;
  checked: boolean;
  expanded: boolean;
  onToggleChecked: () => void;
  onToggleExpanded: () => void;
}) => {
  const meta = CHANGE_META[suggestion.change_type];
  const Icon = meta.Icon;

  return (
    <li
      className={cn(meta.row, "usage-rise")}
      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={onToggleChecked}
          className="ci-check mt-0.5"
          data-checked={checked}
        />

        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex-1 text-left min-w-0"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <span className={meta.chip}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
            <span className="text-sm font-semibold text-foreground truncate flex-1">
              {suggestion.section}
            </span>
            <span className="text-muted-foreground">
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground line-clamp-1">{suggestion.reason}</p>
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-12 space-y-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
              Reason
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{suggestion.reason}</p>
          </div>
          {suggestion.current_text && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700 mb-1.5">
                Earlier · in BRD
              </div>
              <div className="ci-diff ci-diff--from">
                <span className="line-through opacity-80">{suggestion.current_text}</span>
              </div>
            </div>
          )}
          {suggestion.proposed_text && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-1.5">
                Proposed
              </div>
              <div className="ci-diff ci-diff--to">{suggestion.proposed_text}</div>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

export default BRDComparisonPage;
