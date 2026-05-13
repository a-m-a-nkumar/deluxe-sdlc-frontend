import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  GitPullRequest,
  ExternalLink,
  Bell,
  BellRing,
  Link2,
  ArrowLeft,
  GitCompareArrows,
  ArrowRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const INTEREST_KEY = "sdlc_pr_sync_interest";

const PRSyncPlaceholder = () => {
  const navigate = useNavigate();
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    setNotified(localStorage.getItem(INTEREST_KEY) === "1");
  }, []);

  const handleNotify = () => {
    if (notified) return;
    localStorage.setItem(INTEREST_KEY, "1");
    setNotified(true);
    toast.success("We'll let you know when PR Sync is ready.");
  };

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="pr-sync" showBackButton onBack={() => navigate("/")}>
        <div className="max-w-4xl mx-auto px-8 py-10">
          {/* ── Header ────────────────────────────────────────────── */}
          <header className="mb-8 usage-rise">
            <button
              onClick={() => navigate("/brd-sync")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-3 h-3" />
              Code Intelligence
            </button>

            <div className="usage-section-mark mb-3">
              <GitPullRequest className="h-3.5 w-3.5 text-primary" />
              <span className="usage-section-num">03</span>
              <span>Code Intelligence · PR Sync</span>
              <span className="ml-2 text-[9px] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Soon
              </span>
            </div>
            <h1 className="usage-num-display text-[2.6rem] leading-[1.05] font-bold text-foreground">
              Reconcile BRDs with PRs
            </h1>
            <div className="usage-baseline-rule mt-3 max-w-[55%]" />
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              When this ships, Velox will analyse the commits in a Bitbucket PR and propose BRD
              changes to keep the spec in sync with shipping code — no IDE step required.
            </p>
          </header>

          {/* ── Flow diagram ─────────────────────────────────────── */}
          <Card className="usage-card-soft p-7 mb-8 usage-corner-brackets usage-rise">
            <div className="usage-section-mark mb-5">
              <span>How it will work</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 md:gap-2 items-stretch mb-5">
              <FlowNode
                label="Bitbucket PR"
                sub="feat/payments · #1247"
                Icon={GitPullRequest}
              />
              <FlowArrow />
              <FlowNode
                label="Diff agent"
                sub="walks commits · summarises"
                Icon={GitCompareArrows}
                emphasis
              />
              <FlowArrow />
              <FlowNode
                label="BRD edits"
                sub="proposed · stage for review"
                Icon={ArrowRight}
              />
            </div>

            <div className="usage-section-rule my-5" />

            <ol className="space-y-3">
              <FlowStep n="01">
                Connect your Bitbucket workspace once — repos and branches sync into the agent.
              </FlowStep>
              <FlowStep n="02">
                When a PR opens, the agent walks the diff and summarises what changed in the same
                shape as the IDE-side <code className="font-mono text-primary bg-primary/[0.06] px-1 rounded">code-summary</code> MCP.
              </FlowStep>
              <FlowStep n="03">
                Pick the PR + an existing BRD from this page and run the diff agent — same approval
                flow as <span className="font-semibold text-foreground">BRD Sync</span>.
              </FlowStep>
            </ol>
          </Card>

          {/* ── Action tiles ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PrepTile
              index="04"
              eyebrow="Pre-flight · ready now"
              title="Connect Bitbucket"
              body="Link your workspace now. Existing repos and branches will already be available the moment PR Sync flips on."
              Icon={Link2}
              cta="Open integrations"
              onClick={() => navigate("/")}
              ctaIcon={ExternalLink}
            />
            <PrepTile
              index="05"
              eyebrow={notified ? "On the list" : "Signal demand"}
              title="Notify me when ready"
              body="Tag yourself so the team knows there's demand. A banner will light up here when the feature flips on."
              Icon={notified ? BellRing : Bell}
              cta={notified ? "You're on the list" : "Notify me"}
              onClick={handleNotify}
              disabled={notified}
              emphasis
            />
          </div>

          {/* ── Footer rail ───────────────────────────────────────── */}
          <div className="mt-12 flex items-center justify-between gap-6 usage-rise">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Roadmap · upcoming
            </div>
            <div className="usage-section-rule flex-1" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">
              Spec ⇄ code · in lockstep
            </div>
          </div>
        </div>
      </MainLayout>
    </div>
  );
};

const FlowNode = ({
  label,
  sub,
  Icon,
  emphasis,
}: {
  label: string;
  sub: string;
  Icon: typeof GitPullRequest;
  emphasis?: boolean;
}) => (
  <div
    className={cn(
      "rounded-lg border bg-card p-4 text-center flex flex-col items-center justify-center min-h-[110px]",
      emphasis ? "border-primary/30 bg-primary/[0.04]" : "border-border",
    )}
  >
    <span
      className={cn(
        "grid place-items-center h-9 w-9 rounded-md mb-2",
        emphasis
          ? "bg-primary/15 ring-1 ring-primary/25 text-primary"
          : "bg-muted ring-1 ring-border text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
    <div className="text-xs font-semibold text-foreground">{label}</div>
    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight font-mono">{sub}</div>
  </div>
);

const FlowArrow = () => (
  <div className="hidden md:flex items-center justify-center" aria-hidden>
    <div className="flex items-center gap-1">
      <span className="w-2 h-px bg-border" />
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <span className="w-2 h-px bg-border" />
    </div>
  </div>
);

const FlowStep = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <li className="flex gap-3 items-start">
    <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-primary mt-0.5 min-w-[24px]">
      {n}
    </span>
    <span className="text-sm text-foreground/85 leading-relaxed">{children}</span>
  </li>
);

const PrepTile = ({
  index,
  eyebrow,
  title,
  body,
  Icon,
  cta,
  onClick,
  disabled,
  emphasis,
  ctaIcon: CtaIcon,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  Icon: typeof Link2;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  ctaIcon?: typeof ExternalLink;
}) => (
  <Card
    className={cn(
      "relative usage-card-soft usage-corner-brackets p-6 overflow-hidden",
      emphasis && "border-primary/25",
    )}
  >
    <span className="absolute top-4 right-5 font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground/70">
      {index}
    </span>
    <Icon
      className="absolute -bottom-6 -right-4 h-28 w-28 text-primary/[0.04] pointer-events-none"
      strokeWidth={1}
      aria-hidden
    />

    <div className="relative">
      <span className="inline-grid place-items-center h-10 w-10 rounded-lg bg-primary/10 ring-1 ring-primary/15 mb-4">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80 mb-1.5">
        {eyebrow}
      </div>
      <div className="text-base font-semibold text-foreground mb-2">{title}</div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-5">{body}</p>
      <Button
        size="sm"
        variant={emphasis && !disabled ? "default" : "outline"}
        onClick={onClick}
        disabled={disabled}
      >
        {cta}
        {CtaIcon && <CtaIcon className="w-3.5 h-3.5 ml-1.5" />}
      </Button>
    </div>
  </Card>
);

export default PRSyncPlaceholder;
