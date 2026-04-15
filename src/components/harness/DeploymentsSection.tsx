import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listPipelineExecutions,
  buildConfig,
  type HarnessCredentials,
  type HarnessPipelineExecution,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
  onNavigate: (section: string, params?: Record<string, string>) => void;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === "SUCCESS")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Success</span>;
  if (s === "FAILED" || s === "FAILURE")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Failed</span>;
  if (s === "RUNNING")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"><Loader2 className="w-3 h-3 animate-spin" />Running</span>;
  if (s === "ABORTED")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Aborted</span>;
  if (s === "WAITING" || s === "QUEUED")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">Waiting</span>;
  return <span className="text-xs text-muted-foreground">{status || "—"}</span>;
}

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function calcDuration(start?: number, end?: number, status?: string) {
  if (!start) return "—";
  const endMs = end || (["RUNNING", "WAITING", "QUEUED"].includes(status?.toUpperCase() || "") ? Date.now() : undefined);
  if (!endMs) return "—";
  const s = Math.floor((endMs - start) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}m ${sec}s`;
}

export default function DeploymentsSection({ credentials, onNavigate }: Props) {
  const config = buildConfig(credentials.apiKey);

  const [executions, setExecutions] = useState<HarnessPipelineExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExecutions = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setVisibleCount(10);
    try {
      const data = await listPipelineExecutions(config, credentials.orgId, credentials.projectId);
      setExecutions(data);
      setError("");
    } catch (e: any) {
      if (!silent) setError(e.message || "Failed to load executions");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [credentials]);

  useEffect(() => {
    const activeStatuses = ["RUNNING", "WAITING", "QUEUED"];
    const hasActive = executions.some(e => activeStatuses.includes(e.status?.toUpperCase() || ""));
    if (hasActive) {
      pollingRef.current = setInterval(() => fetchExecutions(true), 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [executions]);

  const filtered = executions.filter(exec => {
    if (!exec.startTs) return true;
    const d = new Date(exec.startTs);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Deployments</h2>
          <p className="text-sm text-muted-foreground">
            Recent pipeline executions — click any row to view logs
            {executions.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                (showing {Math.min(visibleCount, filtered.length)} of {filtered.length} loaded)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchExecutions()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Date filter bar */}
      {!loading && !error && executions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter by date:</span>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setVisibleCount(10); }}
              className="border rounded px-2 py-1 text-xs bg-background"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setVisibleCount(10); }}
              className="border rounded px-2 py-1 text-xs bg-background"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setVisibleCount(10); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Executions table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 p-4 bg-red-50 rounded">{error}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pipeline</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Run #</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Started</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visibleCount).map(exec => (
                <tr
                  key={exec.planExecutionId}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onNavigate("logs", { executionId: exec.planExecutionId })}
                  title="Click to view logs"
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{exec.pipelineIdentifier}</div>
                    <div className="text-xs text-muted-foreground">{exec.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">#{exec.runSequence}</td>
                  <td className="px-4 py-3"><StatusBadge status={exec.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(exec.startTs)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{calcDuration(exec.startTs, exec.endTs, exec.status)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {dateFrom || dateTo ? "No executions match the selected date range" : "No executions found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {visibleCount < filtered.length && (
            <div className="flex justify-center py-3 border-t">
              <button
                onClick={() => setVisibleCount(v => v + 5)}
                className="text-xs text-primary hover:underline"
              >
                See more ({Math.min(5, filtered.length - visibleCount)} more of {filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
