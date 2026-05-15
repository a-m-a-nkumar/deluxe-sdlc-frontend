import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Calendar, CheckCircle, Clock, Link as LinkIcon, Mail, ShieldCheck,
  Sparkles, Trash2, Triangle, User as UserIcon,
} from "lucide-react";
import type { AccessRole } from "@/services/usageApi";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyUsage } from "@/services/usageApi";
import { integrationsApi } from "@/services/integrationsApi";
import { LinkLucidModal } from "@/components/modals/LinkLucidModal";

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
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
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

const ACCESS_ROLE_LABEL: Record<AccessRole, string> = {
  BOTH: "Tech + Business",
  TECH: "Tech",
  BUSINESS: "Business",
  NONE: "No group access",
};

const formatAccessRole = (role?: AccessRole | null): string =>
  ACCESS_ROLE_LABEL[(role ?? "NONE") as AccessRole];

const getInitials = (email?: string, name?: string | null) => {
  const source = name || email || "";
  if (!source) return "?";
  return source
    .split(/[\s.@]/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || source[0].toUpperCase();
};

const useCountUp = (target: number, durationMs = 900) => {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    startedRef.current = false;
    setValue(0);
    if (!target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
};

const compact = (n: number) => {
  if (n < 1000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
};

const MyProfile = () => {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [isLucidModalOpen, setIsLucidModalOpen] = useState(false);
  const [isUnlinkingLucid, setIsUnlinkingLucid] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-usage", user?.id],
    queryFn: fetchMyUsage,
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const { data: lucidStatus } = useQuery({
    queryKey: ["lucid-status", user?.id],
    queryFn: () => integrationsApi.getLucidStatus(accessToken!),
    enabled: !!accessToken && !!user,
    staleTime: 1000 * 60 * 5,
  });

  const tokenCount = useCountUp(data?.token_usage ?? 0);

  const handleLucidLinked = () => {
    queryClient.invalidateQueries({ queryKey: ["lucid-status"] });
  };

  const handleUnlinkLucid = async () => {
    if (!accessToken) return;
    setIsUnlinkingLucid(true);
    try {
      await integrationsApi.unlinkLucidAccount(accessToken);
      queryClient.invalidateQueries({ queryKey: ["lucid-status"] });
    } finally {
      setIsUnlinkingLucid(false);
    }
  };

  return (
    <MainLayout currentView="my-profile">
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
        {/* Layered atmospheric background — uses theme primary tint, no purple-on-white slop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 usage-fade"
          style={{
            background:
              "radial-gradient(900px 480px at 8% -10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(700px 420px at 100% 100%, hsl(var(--primary) / 0.10), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at top left, black 30%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top left, black 30%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
          {/* Eyebrow */}
          <div className="usage-fade flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Your account</span>
          </div>

          {/* Identity row */}
          <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5 usage-rise stagger-1">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-primary/30 shadow-md">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                    {getInitials(user?.email, user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute inset-0 rounded-full usage-pulse-ring pointer-events-none" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  {data?.name || user?.name || "Your profile"}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {data?.email || user?.email}
                </p>
              </div>
            </div>

            <div className="usage-rise stagger-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/70 px-4 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Signed in &middot; last seen {relativeTime(data?.last_login ?? null)}
              </div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Tokens — hero stat */}
            <Card className="usage-rise stagger-3 relative overflow-hidden border-primary/20 bg-card sm:col-span-2 p-6 sm:p-8">
              <div
                aria-hidden
                className="absolute inset-0 opacity-80"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.10) 0%, transparent 55%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Total tokens used
                </div>
                {isLoading ? (
                  <Skeleton className="mt-4 h-14 w-48" />
                ) : (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-foreground">
                      {compact(tokenCount)}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {(data?.token_usage ?? 0).toLocaleString()} exact
                    </span>
                  </div>
                )}
                <p className="mt-3 text-sm text-muted-foreground max-w-md">
                  Cumulative LLM tokens billed against your account across every assistant in
                  the platform.
                </p>
              </div>

              {/* decorative bar */}
              <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{
                    width: data?.token_usage ? `${Math.min(100, Math.log10((data.token_usage || 1) + 1) * 14)}%` : "8%",
                  }}
                />
              </div>
            </Card>

            {/* Last login */}
            <Card className="usage-rise stagger-4 relative overflow-hidden p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Last login
              </div>
              {isLoading ? (
                <Skeleton className="mt-4 h-7 w-32" />
              ) : (
                <>
                  <div className="mt-3 text-2xl font-bold text-foreground">
                    {relativeTime(data?.last_login ?? null)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(data?.last_login ?? null)}
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* Meta row */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="usage-rise stagger-5 p-5 flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Member since
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {isLoading ? <Skeleton className="h-4 w-32" /> : formatDateTime(data?.created_at ?? null)}
                </div>
              </div>
            </Card>

            <Card className="usage-rise stagger-6 p-5 flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Access role
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    formatAccessRole(data?.access_role)
                  )}
                </div>
              </div>
            </Card>

            <Card className="usage-rise stagger-6 p-5 flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <UserIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  User ID
                </div>
                <div className="mt-1 text-sm font-mono text-foreground truncate">
                  {data?.user_id || user?.id || "—"}
                </div>
              </div>
            </Card>
          </div>

          {/* Integrations — third-party API keys the user has linked. */}
          <div className="mt-10 usage-rise stagger-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              <LinkIcon className="h-3.5 w-3.5 text-primary" />
              <span>Integrations</span>
            </div>
            <Card className="p-6">
              {/* Lucid */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-md bg-primary/10 p-2 flex-shrink-0">
                    <Triangle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Lucid</span>
                      {lucidStatus?.linked && lucidStatus?.key_valid && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
                          <CheckCircle className="h-3 w-3" /> Connected
                        </span>
                      )}
                      {lucidStatus?.linked && !lucidStatus?.key_valid && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          Key invalid — re-link
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground max-w-md">
                      Personal Lucid REST API key. Used to fetch diagrams you generate in
                      Lucid AI back into the Architecture session so they can be embedded
                      in the SAD.
                    </p>
                    {lucidStatus?.linked_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Linked {relativeTime(lucidStatus.linked_at)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lucidStatus?.linked ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLucidModalOpen(true)}
                      >
                        Update key
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUnlinkLucid}
                        disabled={isUnlinkingLucid}
                        title="Unlink Lucid"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setIsLucidModalOpen(true)}>
                      <LinkIcon className="mr-2 h-4 w-4" /> Link Lucid
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {isError && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Couldn't load your usage right now. Please try again later.
            </div>
          )}
        </div>
      </div>

      <LinkLucidModal
        isOpen={isLucidModalOpen}
        onClose={() => setIsLucidModalOpen(false)}
        onSuccess={handleLucidLinked}
        isUpdateMode={!!lucidStatus?.linked}
      />
    </MainLayout>
  );
};

export default MyProfile;
