import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronRight,
  Clock,
  Code2,
  Coins,
  FileText,
  FlaskConical,
  History,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Workflow,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fetchOrganizationUsage,
  type AccessRole,
  type ModuleUsage,
  type UserUsage,
} from "@/services/usageApi";

// ─────────────────────────────────────────────────────────────────────────
// Module catalog — single source of truth. IDs mirror the sidebar so when
// the backend ships per-module telemetry, IDs line up automatically.
// ─────────────────────────────────────────────────────────────────────────
const MODULE_CATALOG: Record<
  string,
  { label: string; Icon: typeof FileText }
> = {
  brd: { label: "BRD Assistant", Icon: FileText },
  confluence: { label: "Confluence", Icon: BookOpen },
  "pair-programming": { label: "Pair Programming", Icon: Code2 },
  testing: { label: "Testing", Icon: FlaskConical },
  harness: { label: "Deployment", Icon: Workflow },
};

const moduleMeta = (id: string) =>
  MODULE_CATALOG[id] ?? { label: id, Icon: Layers };

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const relativeTime = (iso: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
};

const compact = (n: number) => {
  if (n < 1000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
};

const getInitials = (email: string, name?: string | null) => {
  const source = name || email || "";
  if (!source) return "?";
  return (
    source
      .split(/[\s.@]/)
      .filter(Boolean)
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || source[0].toUpperCase()
  );
};

// Access role chip — derived from Azure AD group membership and refreshed
// every authenticated request server-side. Four tiers: BOTH / TECH /
// BUSINESS / NONE. Visual treatment is restrained — same eyebrow vocabulary
// as everything else on this page so it doesn't compete with the spend lane.
const ACCESS_ROLE_DISPLAY: Record<
  AccessRole,
  { label: string; className: string }
> = {
  BOTH: {
    label: "Tech + Business",
    className: "border-primary/35 bg-primary/10 text-primary",
  },
  TECH: {
    label: "Tech",
    className: "border-primary/30 bg-primary/[0.06] text-primary",
  },
  BUSINESS: {
    label: "Business",
    className:
      "border-foreground/20 bg-muted text-foreground/80",
  },
  NONE: {
    label: "No groups",
    className:
      "border-muted-foreground/20 bg-transparent text-muted-foreground",
  },
};

const AccessRoleChip = ({ role }: { role?: AccessRole | null }) => {
  const resolved = (role ?? "NONE") as AccessRole;
  const { label, className } = ACCESS_ROLE_DISPLAY[resolved];
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        className,
      )}
      title={`Access role: ${label}`}
    >
      {label}
    </span>
  );
};

const isWithinDays = (iso: string | null, days: number) => {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;
};

// Four-tier recency: 0=today, 1=this week, 2=this month, 3=dormant/never.
// Drives both the band-segment alpha and the row presence dot.
type RecencyTier = 0 | 1 | 2 | 3;
const recencyTier = (iso: string | null): RecencyTier => {
  if (!iso) return 3;
  const days = (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
  if (days < 1) return 0;
  if (days < 7) return 1;
  if (days < 30) return 2;
  return 3;
};
const RECENCY_LABEL: Record<RecencyTier, string> = {
  0: "Today",
  1: "This week",
  2: "This month",
  3: "Dormant",
};

// ─────────────────────────────────────────────────────────────────────────
// StatCard — headline stat with optional accent gradient.
// ─────────────────────────────────────────────────────────────────────────
const statCardVariants = cva(
  "relative overflow-hidden p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.25)]",
  {
    variants: {
      tone: {
        default: "",
        accent:
          "before:absolute before:inset-0 before:bg-[linear-gradient(135deg,hsl(var(--primary)/0.10)_0%,transparent_60%)]",
      },
    },
    defaultVariants: { tone: "default" },
  }
);

interface StatCardProps extends VariantProps<typeof statCardVariants> {
  Icon: typeof FileText;
  label: string;
  value: string | null;
  sub?: string;
  delayClass?: string;
  index?: number;
}

const StatCard = ({
  Icon,
  label,
  value,
  sub,
  tone,
  delayClass,
  index,
}: StatCardProps) => (
  <Card
    data-tone={tone ?? "default"}
    className={cn(
      statCardVariants({ tone }),
      "usage-rise usage-stat-card usage-card-soft",
      delayClass,
    )}
  >
    <span aria-hidden className="usage-stat-rule" />
    {typeof index === "number" && (
      <span className="usage-stat-index">{String(index).padStart(2, "0")}</span>
    )}
    <Icon className="usage-ghost-icon h-24 w-24" strokeWidth={1.4} aria-hidden />
    <div className="relative">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 ring-1 ring-primary/15">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </span>
        {label}
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-9 w-28" />
      ) : (
        <div className="usage-num-display mt-3 text-[2.4rem] font-bold text-foreground">
          {value}
        </div>
      )}
      <div className="usage-baseline-rule mt-2.5 max-w-[80%]" />
      {sub && (
        <div className="usage-meta-label mt-2 truncate" title={sub}>
          {sub}
        </div>
      )}
    </div>
  </Card>
);

type SortKey = "name" | "tokens" | "last_login";
type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────────────────
// SortHeader
// ─────────────────────────────────────────────────────────────────────────
const SortHeader = ({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      align === "right" && "ml-auto"
    )}
  >
    {label}
    {active ? (
      dir === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// Per-module sparkbar (drill-in cards) — counts events per day for ONE module.
// ─────────────────────────────────────────────────────────────────────────
const buildSparkbar = (
  events: UserUsage["recent_events"],
  moduleId: string,
): number[] => {
  const buckets = Array(7).fill(0) as number[];
  if (!events) return buckets;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  for (const ev of events) {
    if (ev.module !== moduleId || !ev.timestamp) continue;
    const t = new Date(ev.timestamp).getTime();
    const dayDiff = Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
    if (dayDiff >= 0 && dayDiff < 7) {
      buckets[6 - dayDiff] += 1;
    }
  }
  return buckets;
};

// All-modules sparkbar — counts every event per day for the row spark.
const buildTotalSparkbar = (events: UserUsage["recent_events"]): number[] => {
  const buckets = Array(7).fill(0) as number[];
  if (!events) return buckets;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  for (const ev of events) {
    if (!ev.timestamp) continue;
    const t = new Date(ev.timestamp).getTime();
    const dayDiff = Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
    if (dayDiff >= 0 && dayDiff < 7) {
      buckets[6 - dayDiff] += 1;
    }
  }
  return buckets;
};

// ─────────────────────────────────────────────────────────────────────────
// Drill-in cards (used inside the activity sheet).
// ─────────────────────────────────────────────────────────────────────────

const ModuleCard = ({
  module,
  rank,
  total,
  events,
  isTop,
}: {
  module: ModuleUsage;
  rank: number;
  total: number;
  events: UserUsage["recent_events"];
  isTop: boolean;
}) => {
  const meta = moduleMeta(module.id);
  const Icon = meta.Icon;
  const alpha = 0.3 + (1 - rank / Math.max(total - 1, 1)) * 0.6;
  const moduleEvents = (events ?? []).filter((e) => e.module === module.id);
  const visibleEvents = moduleEvents.slice(0, 3);
  const remaining = Math.max(module.events_count - visibleEvents.length, 0);
  const sparkbar = buildSparkbar(events, module.id);
  const sparkMax = Math.max(1, ...sparkbar);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-all",
        isTop
          ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_8px_24px_-12px_hsl(var(--primary)/0.25)]"
          : "border-border hover:border-primary/30"
      )}
      style={{
        animation: "usage-rise 0.5s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${Math.min(rank * 60, 360)}ms`,
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: `hsl(var(--primary) / ${alpha})` }}
      />

      <div className="pl-5 pr-4 py-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="grid h-8 w-8 place-items-center rounded-md shrink-0"
              style={{ backgroundColor: `hsl(var(--primary) / ${alpha * 0.22})` }}
            >
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate">
              {meta.label}
            </h3>
          </div>
          {isTop && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
              <Sparkles className="h-2.5 w-2.5" /> Top
            </span>
          )}
        </header>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums leading-none text-foreground">
              {module.events_count}
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {module.events_count === 1 ? "event" : "events"}
            </span>
          </div>

          <div className="flex items-end gap-[3px] h-7" aria-label="7-day activity">
            {sparkbar.map((count, i) => {
              const h = count > 0 ? Math.max((count / sparkMax) * 100, 22) : 6;
              return (
                <div
                  key={i}
                  className="w-[5px] rounded-[1px] transition-all"
                  title={
                    count > 0
                      ? `${count} event${count === 1 ? "" : "s"}, ${i === 6 ? "today" : i === 5 ? "yesterday" : `${6 - i}d ago`}`
                      : `0 events, ${i === 6 ? "today" : i === 5 ? "yesterday" : `${6 - i}d ago`}`
                  }
                  style={{
                    height: `${h}%`,
                    backgroundColor:
                      count > 0
                        ? `hsl(var(--primary) / ${0.4 + (count / sparkMax) * 0.6})`
                        : "hsl(var(--muted-foreground) / 0.18)",
                  }}
                />
              );
            })}
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Last seen
            </div>
            <div className="text-xs font-medium text-foreground tabular-nums">
              {relativeTime(module.last_event_at)}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/60" />

        {visibleEvents.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {visibleEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: `hsl(var(--primary) / ${alpha})` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-foreground leading-snug">
                    {ev.action}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {relativeTime(ev.timestamp)} · {formatDateTime(ev.timestamp)}
                  </div>
                </div>
              </li>
            ))}
            {remaining > 0 && (
              <li className="pt-1 pl-4 text-[11px] italic text-muted-foreground">
                +{remaining} earlier event{remaining === 1 ? "" : "s"} not shown
              </li>
            )}
          </ol>
        ) : (
          <p className="mt-3 text-[11px] italic text-muted-foreground">
            {module.events_count > 0
              ? `${module.events_count} event${module.events_count === 1 ? "" : "s"} recorded — detail not retained.`
              : "No detailed events captured yet."}
          </p>
        )}
      </div>
    </article>
  );
};

const UserActivitySheet = ({
  user,
  totalOrgTokens,
}: {
  user: UserUsage | null;
  totalOrgTokens: number;
}) => {
  if (!user) return null;

  // Only surface modules that are still in the catalog — keeps deprecated
  // module data (jira/design/figma) from leaking into the drill-in sheet.
  const modules = (user.modules ?? []).filter((m) => m.id in MODULE_CATALOG);
  const sortedModules = [...modules].sort(
    (a, b) => b.events_count - a.events_count,
  );
  const totalEvents = sortedModules.reduce((acc, m) => acc + m.events_count, 0);
  const orgShare = totalOrgTokens > 0 ? user.token_usage / totalOrgTokens : 0;
  const displayName = user.name || user.email.split("@")[0];

  return (
    <div className="flex h-full flex-col">
      <header className="usage-sheet-header relative border-b border-border px-6 pt-7 pb-5">
        <span className="usage-sheet-stamp">DRILL-IN</span>
        <div className="usage-section-mark">
          <History className="h-3.5 w-3.5 text-primary" />
          <span>Module activity</span>
        </div>
        <div className="mt-4 flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-primary/30 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]">
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
              {getInitials(user.email, user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="usage-num-display text-2xl font-bold text-foreground truncate">
              {displayName}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{user.email}</p>
            <AccessRoleChip role={user.access_role} />
            <div className="usage-baseline-rule mt-2.5 max-w-[60%]" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill
            icon={<Activity className="h-3 w-3" />}
            value={String(totalEvents)}
            label={totalEvents === 1 ? "event" : "events"}
          />
          <StatPill
            icon={<Coins className="h-3 w-3" />}
            value={compact(user.token_usage)}
            label="tokens"
          />
          <StatPill
            icon={<Clock className="h-3 w-3" />}
            value={relativeTime(user.last_login)}
            label="last seen"
          />
          {totalOrgTokens > 0 && (
            <StatPill
              icon={<TrendingUp className="h-3 w-3" />}
              value={`${Math.round(orgShare * 100)}%`}
              label="of team"
            />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/20">
        {sortedModules.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No module activity yet
            </h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Once {displayName} starts using Veluxe modules, each module's events,
              timestamps, and recent actions will appear here as a card.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Awaiting activity
            </span>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 border-b border-border/80 bg-card/90 backdrop-blur px-5 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {sortedModules.length} module{sortedModules.length === 1 ? "" : "s"} touched
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                ranked by event count
              </span>
            </div>
            <div className="space-y-3 px-4 py-4">
              {sortedModules.map((m, idx) => (
                <ModuleCard
                  key={m.id}
                  module={m}
                  rank={idx}
                  total={sortedModules.length}
                  events={user.recent_events}
                  isTop={idx === 0 && sortedModules.length > 1}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatPill = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) => (
  <div className="rounded-md border border-border/60 bg-card px-3 py-2">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
    </div>
    <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground tracking-tight">
      {value}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Roster row — ledger composition.
//
// A presence dot (saturation = recency) anchors the left, the avatar +
// identity sit in a single lockup, the spend lane shows the headline number
// over a peer-relative bar, and a 7-day spark gives a gut feel for activity
// shape. The "View modules" pill on the right is the explicit affordance for
// drilling into per-module activity; the row body is also clickable.
// ─────────────────────────────────────────────────────────────────────────
const ROSTER_GRID =
  "grid grid-cols-[minmax(0,1fr)_90px_110px_56px] sm:grid-cols-[minmax(0,1fr)_120px_110px_120px_140px] gap-3 sm:gap-4";

const RosterRow = ({
  user,
  peerMax,
  isSelected,
  onClick,
  animDelay,
}: {
  user: UserUsage;
  peerMax: number;
  isSelected: boolean;
  onClick: () => void;
  animDelay: number;
}) => {
  const tier = recencyTier(user.last_login);
  const tokens = user.token_usage ?? 0;
  const pct = peerMax > 0 ? tokens / peerMax : 0;
  const sparkbar = buildTotalSparkbar(user.recent_events);
  const sparkMax = Math.max(1, ...sparkbar);
  const sparkTotal = sparkbar.reduce((a, b) => a + b, 0);
  const displayName = user.name || user.email.split("@")[0];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group/row relative items-center cursor-pointer px-5 py-3.5 transition-colors",
        ROSTER_GRID,
        isSelected ? "bg-primary/[0.06]" : "hover:bg-primary/[0.035]",
      )}
      style={{
        animation: "usage-rise 0.45s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${animDelay}ms`,
      }}
    >
      <span
        aria-hidden
        className="usage-row-accent absolute left-0 top-2 bottom-2 w-[3px] pointer-events-none"
        data-selected={isSelected ? "true" : "false"}
      />
      {/* Identity */}
      <div className="flex items-center gap-3.5 min-w-0">
        <Avatar
          className="usage-avatar-ring h-9 w-9 shrink-0"
          data-tier={tier}
          title={RECENCY_LABEL[tier]}
        >
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
            {getInitials(user.email, user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          <AccessRoleChip role={user.access_role} />
        </div>
      </div>

      {/* Spend lane */}
      <div className="min-w-0">
        <div className="text-sm font-semibold tabular-nums text-foreground">
          {compact(tokens)}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(pct * 100, tokens > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {/* 7-day spark — desktop only */}
      <div className="hidden min-w-0 sm:block">
        {sparkTotal > 0 ? (
          <>
            <div className="flex items-end gap-[2px] h-5" aria-label="7-day activity">
              {sparkbar.map((c, i) => (
                <div
                  key={i}
                  className="w-[5px] rounded-[1px]"
                  title={`${c} event${c === 1 ? "" : "s"}, ${i === 6 ? "today" : i === 5 ? "yesterday" : `${6 - i}d ago`}`}
                  style={{
                    height: c > 0 ? `${Math.max((c / sparkMax) * 100, 22)}%` : "10%",
                    backgroundColor:
                      c > 0
                        ? `hsl(var(--primary) / ${0.45 + (c / sparkMax) * 0.55})`
                        : "hsl(var(--muted-foreground) / 0.18)",
                  }}
                />
              ))}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
              {sparkTotal} {sparkTotal === 1 ? "event" : "events"} · 7d
            </div>
          </>
        ) : (
          <div className="text-[11px] italic text-muted-foreground/80">
            No recent activity
          </div>
        )}
      </div>

      {/* Last seen */}
      <div className="min-w-0">
        <div className="text-sm text-foreground tabular-nums">
          {relativeTime(user.last_login)}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums truncate">
          {formatDateTime(user.last_login)}
        </div>
      </div>

      {/* View modules pill — explicit drill-in affordance */}
      <div className="flex justify-end">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              aria-label={`View per-module activity for ${displayName}`}
              className={cn(
                "group/btn relative inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-all whitespace-nowrap",
                "hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "group-hover/row:border-primary group-hover/row:bg-primary group-hover/row:text-primary-foreground",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View modules</span>
              <ChevronRight className="h-3 w-3 opacity-70" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[260px]">
            <div className="text-xs">
              <div className="font-semibold text-foreground">Module-wise activity</div>
              <div className="text-muted-foreground mt-0.5">
                See which Veluxe modules {displayName} used and the events logged in each.
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Module-wise adoption — aggregated from per-user `modules` slices into one
// row per module catalog entry. Captures who's using what across the team.
// ─────────────────────────────────────────────────────────────────────────
type ModuleAdoption = {
  id: string;
  label: string;
  Icon: typeof FileText;
  totalEvents: number;
  totalTokens: number;
  activeDevs: number;
  topUsers: Array<{
    user_id: string;
    name: string;
    email: string;
    events: number;
    tokens: number;
  }>;
  lastEventAt: string | null;
  sparkbar: number[];
};

const buildModuleAdoptions = (users: UserUsage[]): ModuleAdoption[] => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const rows = Object.entries(MODULE_CATALOG).map(([id, meta]) => {
    let totalEvents = 0;
    let totalTokens = 0;
    let lastEventAt: string | null = null;
    const userMetrics: ModuleAdoption["topUsers"] = [];
    const sparkbar = Array(7).fill(0) as number[];

    for (const user of users) {
      const m = (user.modules ?? []).find((mu) => mu.id === id);
      if (m) {
        totalEvents += m.events_count;
        totalTokens += m.tokens;
        if (m.events_count > 0) {
          userMetrics.push({
            user_id: user.user_id,
            name: user.name || user.email.split("@")[0],
            email: user.email,
            events: m.events_count,
            tokens: m.tokens,
          });
        }
        if (
          m.last_event_at &&
          (!lastEventAt || new Date(m.last_event_at) > new Date(lastEventAt))
        ) {
          lastEventAt = m.last_event_at;
        }
      }
      for (const ev of user.recent_events ?? []) {
        if (ev.module !== id || !ev.timestamp) continue;
        const t = new Date(ev.timestamp).getTime();
        const dayDiff = Math.floor(
          (now.getTime() - t) / (24 * 60 * 60 * 1000),
        );
        if (dayDiff >= 0 && dayDiff < 7) sparkbar[6 - dayDiff] += 1;
      }
    }

    userMetrics.sort((a, b) => b.events - a.events);

    return {
      id,
      label: meta.label,
      Icon: meta.Icon,
      totalEvents,
      totalTokens,
      activeDevs: userMetrics.length,
      topUsers: userMetrics.slice(0, 3),
      lastEventAt,
      sparkbar,
    };
  });

  return rows.sort((a, b) => b.totalEvents - a.totalEvents);
};

const ModuleUsageCard = ({
  adoption,
  totalDevs,
  rank,
  total,
  onUserClick,
  animDelay,
}: {
  adoption: ModuleAdoption;
  totalDevs: number;
  rank: number;
  total: number;
  onUserClick: (id: string) => void;
  animDelay: number;
}) => {
  const Icon = adoption.Icon;
  const sparkMax = Math.max(1, ...adoption.sparkbar);
  const adoptionPct = totalDevs > 0 ? adoption.activeDevs / totalDevs : 0;
  const isActive = adoption.totalEvents > 0;
  // Side-rail / icon tint follows rank — top module reads loudest, tail fades.
  const alpha = 0.3 + (1 - rank / Math.max(total - 1, 1)) * 0.6;

  return (
    <article
      className={cn(
        "group usage-corner-brackets relative overflow-hidden rounded-lg border bg-card transition-all usage-card-soft",
        isActive
          ? rank === 0
            ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_8px_24px_-12px_hsl(var(--primary)/0.22)]"
            : "border-border hover:border-primary/30"
          : "border-border/70 bg-card/70",
      )}
      style={{
        animation: "usage-rise 0.5s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${animDelay}ms`,
      }}
    >
      <span aria-hidden className="usage-shimmer-sheen" />
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{
          backgroundColor: isActive
            ? `hsl(var(--primary) / ${alpha})`
            : "hsl(var(--muted-foreground) / 0.18)",
        }}
      />

      <div className="pl-5 pr-4 py-4">
        <header className="flex items-center gap-2.5 min-w-0">
          <div
            className="grid h-9 w-9 place-items-center rounded-md shrink-0"
            style={{
              backgroundColor: isActive
                ? `hsl(var(--primary) / ${alpha * 0.22})`
                : "hsl(var(--muted) / 0.6)",
            }}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <h3 className="text-sm font-semibold text-foreground truncate flex-1">
            {adoption.label}
          </h3>
          {rank === 0 && isActive && total > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
              <Sparkles className="h-2.5 w-2.5" /> Top
            </span>
          )}
        </header>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
              {adoption.totalEvents.toLocaleString()}
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {adoption.totalEvents === 1 ? "event" : "events"}
            </span>
          </div>
          <div className="flex items-end gap-[2px] h-7" aria-label="7-day activity">
            {adoption.sparkbar.map((c, i) => (
              <div
                key={i}
                className="w-[5px] rounded-[1px]"
                title={`${c} event${c === 1 ? "" : "s"}, ${i === 6 ? "today" : i === 5 ? "yesterday" : `${6 - i}d ago`}`}
                style={{
                  height: c > 0 ? `${Math.max((c / sparkMax) * 100, 22)}%` : "10%",
                  backgroundColor:
                    c > 0
                      ? `hsl(var(--primary) / ${0.4 + (c / sparkMax) * 0.6})`
                      : "hsl(var(--muted-foreground) / 0.18)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {adoption.activeDevs}
              </span>{" "}
              of{" "}
              <span className="tabular-nums">{totalDevs}</span> users active
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {Math.round(adoptionPct * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max(adoptionPct * 100, adoption.activeDevs > 0 ? 4 : 0)}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          {adoption.topUsers.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Top users
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  Last {relativeTime(adoption.lastEventAt)}
                </span>
              </div>
              <ul className="space-y-1">
                {adoption.topUsers.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => onUserClick(u.user_id)}
                      className="-mx-1.5 flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-primary/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      aria-label={`View ${u.name}'s module activity`}
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary shrink-0">
                        {getInitials(u.email, u.name)}
                      </span>
                      <span className="flex-1 truncate text-left text-xs font-medium text-foreground">
                        {u.name}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {u.events.toLocaleString()}{" "}
                        {u.events === 1 ? "event" : "events"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">
              No user activity yet.
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ViewToggle — segmented control for switching between Per-user and
// Per-module views. Counts are inline so each tab carries its own headline.
// ─────────────────────────────────────────────────────────────────────────
type UsageView = "team" | "modules";

const ViewToggle = ({
  value,
  onChange,
  teamCount,
  moduleCount,
}: {
  value: UsageView;
  onChange: (v: UsageView) => void;
  teamCount: number | null;
  moduleCount: number | null;
}) => {
  const tabs: Array<{
    id: UsageView;
    label: string;
    Icon: typeof Users;
    count: number | null;
  }> = [
    { id: "team", label: "Per user", Icon: Users, count: teamCount },
    { id: "modules", label: "Per module", Icon: Layers, count: moduleCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Usage view"
      className="usage-toggle-shell inline-flex rounded-full border border-border p-1"
    >
      {tabs.map(({ id, label, Icon, count }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              active
                ? "bg-card text-foreground shadow-[0_1px_3px_hsl(var(--border)/0.6),0_0_0_1px_hsl(var(--border)/0.6)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground/80",
              )}
            />
            {label}
            {count !== null && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/10 text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
const OrganizationUsage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization-usage"],
    queryFn: fetchOrganizationUsage,
    staleTime: 1000 * 30,
  });

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tokens");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [view, setView] = useState<UsageView>("team");

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const rows = useMemo<UserUsage[]>(() => {
    const all = data?.users ?? [];
    const filtered = query
      ? all.filter((u) => {
          const q = query.toLowerCase();
          return (
            (u.email?.toLowerCase().includes(q) ?? false) ||
            (u.name?.toLowerCase().includes(q) ?? false)
          );
        })
      : all;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || a.email || "").localeCompare(b.name || b.email || "") * dir;
      }
      if (sortKey === "tokens") {
        return ((a.token_usage || 0) - (b.token_usage || 0)) * dir;
      }
      const at = a.last_login ? new Date(a.last_login).getTime() : 0;
      const bt = b.last_login ? new Date(b.last_login).getTime() : 0;
      return (at - bt) * dir;
    });
  }, [data, query, sortKey, sortDir]);

  const maxTokens = useMemo(
    () => Math.max(1, ...(data?.users ?? []).map((u) => u.token_usage || 0)),
    [data]
  );

  const activeLast30 = useMemo(
    () => (data?.users ?? []).filter((u) => isWithinDays(u.last_login, 30)).length,
    [data]
  );

  const avgPerUser = useMemo(() => {
    if (!data?.users?.length) return 0;
    return Math.round((data.total_tokens || 0) / data.users.length);
  }, [data]);

  const selectedUser = useMemo(
    () => data?.users.find((u) => u.user_id === selectedUserId) ?? null,
    [data, selectedUserId]
  );

  const moduleAdoptions = useMemo(
    () => buildModuleAdoptions(data?.users ?? []),
    [data]
  );

  return (
    <MainLayout currentView="organization-usage">
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
        {/* Atmospheric — two balanced ambient blobs + paper grain + thin top edge. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 usage-fade">
          <div
            className="usage-blob"
            style={{
              top: "-120px",
              right: "-120px",
              width: "520px",
              height: "520px",
              background:
                "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent)",
            }}
          />
          <div
            className="usage-blob"
            style={{
              bottom: "-160px",
              left: "-140px",
              width: "480px",
              height: "480px",
              opacity: 0.35,
              background:
                "radial-gradient(closest-side, hsl(var(--primary) / 0.14), transparent)",
            }}
          />
          <div className="usage-grain" />
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.35), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-12">
          {/* Header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="usage-rise stagger-1 min-w-0">
              <div className="usage-section-mark">
                <span className="usage-section-num">01</span>
                <span>Organisation Usage</span>
              </div>
              <h1 className="usage-text-gradient usage-num-display mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
                Team Usage
              </h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl leading-relaxed">
                Adoption from two angles — token spend per user, and per-module
                activity across the team.
              </p>
              <div className="usage-section-rule usage-rule-grow mt-5 max-w-xs" />
            </div>

            {view === "team" && (
              <div className="usage-rise stagger-2 relative shrink-0">
                <div className="usage-search-glow flex items-center rounded-md border border-input bg-card transition-all">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users…"
                    className="w-full sm:w-72 pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summary stat strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              index={1}
              Icon={Users}
              label="Total users"
              value={isLoading ? null : (data?.total_users ?? 0).toLocaleString()}
              delayClass="stagger-3"
            />
            <StatCard
              index={2}
              tone="accent"
              Icon={Coins}
              label="Total tokens"
              value={isLoading ? null : compact(data?.total_tokens ?? 0)}
              sub={data ? `${(data.total_tokens || 0).toLocaleString()} TOKENS` : undefined}
              delayClass="stagger-4"
            />
            <StatCard
              index={3}
              Icon={UserCheck}
              label="Active last 30d"
              value={isLoading ? null : activeLast30.toLocaleString()}
              sub={
                data
                  ? `${Math.round((activeLast30 / Math.max(data.total_users, 1)) * 100)}% OF TEAM`
                  : undefined
              }
              delayClass="stagger-5"
            />
            <StatCard
              index={4}
              Icon={TrendingUp}
              label="Avg / user"
              value={isLoading ? null : compact(avgPerUser)}
              sub="TOKENS PER USER"
              delayClass="stagger-6"
            />
          </div>

          {/* View toggle + section caption */}
          <div className="usage-rise stagger-4 mt-12">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="usage-section-mark">
                <span className="usage-section-num">02</span>
                <span>{view === "team" ? "Per-user activity" : "Per-module activity"}</span>
              </div>
              {view === "team" && !isLoading && data && (
                <div className="usage-meta-label tabular-nums">
                  Showing {String(rows.length).padStart(2, "0")}
                  {query && rows.length !== data.users.length && (
                    <span className="text-muted-foreground/60">
                      {" "}of {String(data.users.length).padStart(2, "0")}
                    </span>
                  )}
                </div>
              )}
              {view === "modules" && !isLoading && (
                <div className="usage-meta-label tabular-nums">
                  <span className="text-foreground">
                    {String(moduleAdoptions.filter((m) => m.totalEvents > 0).length).padStart(2, "0")}
                  </span>{" "}
                  / {String(moduleAdoptions.length).padStart(2, "0")} in use
                </div>
              )}
            </div>
            <div className="usage-section-rule mb-4" />
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <ViewToggle
                value={view}
                onChange={setView}
                teamCount={isLoading ? null : data?.total_users ?? 0}
                moduleCount={isLoading ? null : moduleAdoptions.length}
              />
            </div>

            {view === "team" && (
              <Card className="relative overflow-hidden usage-card-soft">
                {/* Sortable header */}
                <div
                  className={cn(
                    "items-center border-b border-border/80 px-5 py-2.5",
                    "bg-gradient-to-b from-muted/50 to-muted/20",
                    ROSTER_GRID,
                  )}
                >
                  <SortHeader
                    label="User"
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => onSort("name")}
                  />
                  <SortHeader
                    label="Tokens"
                    active={sortKey === "tokens"}
                    dir={sortDir}
                    onClick={() => onSort("tokens")}
                  />
                  <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">
                    Activity
                  </span>
                  <SortHeader
                    label="Last seen"
                    active={sortKey === "last_login"}
                    dir={sortDir}
                    onClick={() => onSort("last_login")}
                  />
                  <span className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Module activity
                  </span>
                </div>

                <div className="usage-zebra divide-y divide-border/60">
                  {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "items-center px-5 py-3.5",
                          ROSTER_GRID,
                        )}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="mt-1.5 h-3 w-44" />
                          </div>
                        </div>
                        <div>
                          <Skeleton className="h-3.5 w-16" />
                          <Skeleton className="mt-1.5 h-1 w-full rounded-full" />
                        </div>
                        <div className="hidden sm:block">
                          <Skeleton className="h-5 w-24" />
                        </div>
                        <div>
                          <Skeleton className="h-3.5 w-20" />
                          <Skeleton className="mt-1 h-3 w-28" />
                        </div>
                        <div className="flex justify-end">
                          <Skeleton className="h-7 w-14 rounded-full sm:w-28" />
                        </div>
                      </div>
                    ))}

                  {!isLoading && rows.length === 0 && (
                    <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                      {query ? "No users match that search." : "No users yet."}
                    </div>
                  )}

                  {!isLoading &&
                    rows.map((u, idx) => (
                      <RosterRow
                        key={u.user_id}
                        user={u}
                        peerMax={maxTokens}
                        isSelected={selectedUserId === u.user_id}
                        onClick={() => setSelectedUserId(u.user_id)}
                        animDelay={Math.min(idx * 30, 600)}
                      />
                    ))}
                </div>
              </Card>
            )}

            {view === "modules" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-card p-4 pl-5"
                    >
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-7 w-24" />
                      </div>
                      <div className="mt-4">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="mt-1.5 h-1 w-full rounded-full" />
                      </div>
                      <div className="mt-4 border-t border-border/60 pt-3 space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}

                {!isLoading &&
                  moduleAdoptions.map((m, idx) => (
                    <ModuleUsageCard
                      key={m.id}
                      adoption={m}
                      totalDevs={data?.total_users ?? 0}
                      rank={idx}
                      total={moduleAdoptions.length}
                      onUserClick={setSelectedUserId}
                      animDelay={Math.min(idx * 50, 400)}
                    />
                  ))}
              </div>
            )}
          </div>

          {isError && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Couldn't load organization usage. Please try again later.
            </div>
          )}
        </div>

        {/* Activity drill-in sheet */}
        <Sheet
          open={!!selectedUserId}
          onOpenChange={(o) => !o && setSelectedUserId(null)}
        >
          <SheetContent
            side="right"
            className="w-full sm:max-w-2xl p-0 flex flex-col"
          >
            <UserActivitySheet
              user={selectedUser}
              totalOrgTokens={data?.total_tokens ?? 0}
            />
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
};

export default OrganizationUsage;
