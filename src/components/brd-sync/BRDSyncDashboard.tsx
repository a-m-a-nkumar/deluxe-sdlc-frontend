import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  GitCompareArrows,
  ExternalLink,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppState } from "@/contexts/AppStateContext";
import { CodeSummaryPicker } from "./CodeSummaryPicker";
import { CodeSummaryPreview } from "./CodeSummaryPreview";
import type { CodeSummaryPage } from "@/services/brdSyncApi";

export const CODE_SUMMARY_LABEL = "code-summary";

export const BRDSyncDashboard = () => {
  const navigate = useNavigate();
  const { selectedProject, isRestoringProject, setReferenceDocument } = useAppState();
  const [selected, setSelected] = useState<CodeSummaryPage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const spaceKey = selectedProject?.confluence_space_key;

  useEffect(() => {
    setSelected(null);
  }, [spaceKey]);

  useEffect(() => {
    setPreviewOpen(false);
  }, [selected?.page_id]);

  if (isRestoringProject) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-3">
        <div className="ci-scan"><i /><i /><i /><i /><i /></div>
        Loading project…
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="usage-card-soft p-8 usage-corner-brackets">
          <div className="usage-section-mark mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
            <span>No project selected</span>
          </div>
          <h2 className="usage-num-display text-2xl font-bold text-foreground">
            Select a project
          </h2>
          <div className="usage-baseline-rule mt-2.5 max-w-[40%]" />
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Pick a project from the top header to view its code summaries and reconcile them
            against BRDs.
          </p>
        </Card>
      </div>
    );
  }

  if (!spaceKey) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="usage-card-soft p-8 usage-corner-brackets">
          <div className="usage-section-mark mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
            <span>No Confluence space linked</span>
          </div>
          <h2 className="usage-num-display text-2xl font-bold text-foreground">
            Link a space first
          </h2>
          <div className="usage-baseline-rule mt-2.5 max-w-[40%]" />
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Project <strong className="text-foreground">{selectedProject.project_name}</strong>{" "}
            has no Confluence space linked. Link a space in project settings before publishing or
            comparing code summaries.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const handleCreateBRD = () => {
    if (!selected) return;
    setReferenceDocument({
      type: "confluence_page_id",
      pageId: selected.page_id,
      title: selected.title,
    });
    toast.success("Seeding BRD Assistant with this code summary…");
    navigate("/brd-assistant");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* ── Left rail — code summary index ──────────────────────────── */}
      <aside className="w-[360px] flex-shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-5 py-4 border-b border-border bg-card">
          <div className="usage-section-mark">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Code summary index</span>
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground font-mono">
            space · {spaceKey}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <CodeSummaryPicker
            spaceKey={spaceKey}
            selectedPageId={selected?.page_id ?? null}
            onSelect={setSelected}
          />
        </div>
      </aside>

      {/* ── Right canvas — actions ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          {/* hero */}
          <header className="mb-8 usage-rise">
            <div className="usage-section-mark mb-4">
              <GitCompareArrows className="h-3.5 w-3.5 text-primary" />
              <span className="usage-section-num">01</span>
              <span>Code Intelligence · BRD Sync</span>
            </div>
            <h1 className="usage-num-display text-[2.6rem] leading-[1.05] font-bold text-foreground">
              Reconcile BRDs with code
            </h1>
            <div className="usage-baseline-rule mt-3 max-w-[55%]" />
            <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
              Pick a published code summary on the left. Seed a new BRD with it, or diff it
              against an existing BRD and stage the proposed changes for review.
            </p>
          </header>

          {!selected && (
            <Card className="usage-card-soft p-12 text-center usage-corner-brackets usage-rise">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/15 mx-auto">
                <FileText className="h-6 w-6 text-primary" />
              </span>
              <h3 className="usage-num-display mt-4 text-lg font-semibold text-foreground">
                Awaiting a code summary
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Select a published code summary from the index on the left to see seed and compare actions.
              </p>
            </Card>
          )}

          {selected && (
            <div className="space-y-6">
              {/* selected summary panel */}
              <Card className="usage-card-soft p-6 usage-corner-brackets usage-rise">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="usage-eyebrow">Selected · v{selected.version}</span>
                    </div>
                    <h2 className="usage-num-display text-xl font-bold text-foreground truncate">
                      {selected.title}
                    </h2>
                    <div className="usage-baseline-rule mt-2.5 max-w-[50%]" />
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {((selected.labels ?? []).length > 0
                        ? selected.labels!
                        : [CODE_SUMMARY_LABEL]
                      ).map((label) => (
                        <span
                          key={label}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={selected.web_url} target="_blank" rel="noopener noreferrer">
                      Open in Confluence
                      <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                  </Button>
                </div>

                <div className="mt-5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen((v) => !v)}
                    aria-expanded={previewOpen}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {previewOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {previewOpen ? "Hide preview" : "Show preview"}
                  </button>
                  {previewOpen && (
                    <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
                      <CodeSummaryPreview pageId={selected.page_id} />
                    </div>
                  )}
                </div>
              </Card>

              {/* action tiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActionTile
                  index="02"
                  eyebrow="Route · Seed"
                  title="Create BRD from this summary"
                  body="Spin up a fresh BRD conversation with this code summary as the starting context. Use when no spec exists yet."
                  cta="Open BRD Assistant"
                  Icon={Sparkles}
                  onClick={handleCreateBRD}
                />
                <ActionTile
                  index="03"
                  eyebrow="Route · Diff"
                  title="Compare with existing BRD"
                  body="Diff this code summary against a Confluence BRD. Review each proposed add, modify, or remove — approve the ones you want, the page updates in place."
                  cta="Pick a BRD"
                  Icon={GitCompareArrows}
                  emphasis
                  onClick={() => {
                    if (!selected || !spaceKey) return;
                    navigate("/brd-comparison", {
                      state: {
                        projectId: selectedProject.project_id,
                        spaceKey,
                        codeSummary: selected,
                      },
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const ActionTile = ({
  index,
  eyebrow,
  title,
  body,
  cta,
  Icon,
  onClick,
  emphasis,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  Icon: typeof Sparkles;
  onClick: () => void;
  emphasis?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group relative text-left rounded-xl border bg-card p-6 transition-all usage-card-soft usage-corner-brackets",
      "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      emphasis ? "border-primary/25" : "border-border"
    )}
  >
    <span
      className="absolute top-4 right-5 font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground/70"
    >
      {index}
    </span>
    <Icon
      className="absolute -bottom-6 -right-4 h-28 w-28 text-primary/[0.04] pointer-events-none"
      strokeWidth={1}
      aria-hidden
    />

    <div className="relative">
      <span
        className={cn(
          "inline-grid place-items-center h-10 w-10 rounded-lg mb-4 transition-all",
          "bg-primary/10 ring-1 ring-primary/15",
          "group-hover:bg-primary/15 group-hover:ring-primary/30"
        )}
      >
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80 mb-1.5">
        {eyebrow}
      </div>
      <div className="text-base font-semibold text-foreground mb-2">{title}</div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-5">{body}</p>
      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        {cta}
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  </button>
);
