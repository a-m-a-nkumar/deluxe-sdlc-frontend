import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, GitBranch, Rocket } from "lucide-react";
import {
  listPipelines,
  listPipelineExecutions,
  buildConfig,
  type HarnessCredentials,
  type HarnessPipeline,
  type HarnessPipelineExecution,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
  onNavigate: (section: string, params?: Record<string, string>) => void;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const styles: Record<string, string> = {
    SUCCESS: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    RUNNING: "bg-blue-100 text-blue-700",
    ABORTED: "bg-gray-100 text-gray-600",
  };
  const icons: Record<string, JSX.Element> = {
    SUCCESS: <CheckCircle2 className="w-3 h-3" />,
    FAILED: <XCircle className="w-3 h-3" />,
    RUNNING: <Loader2 className="w-3 h-3 animate-spin" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[s] || "bg-gray-100 text-gray-600"
      }`}
    >
      {icons[s]} {status}
    </span>
  );
}

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function OverviewSection({ credentials, onNavigate }: Props) {
  const [pipelines, setPipelines] = useState<HarnessPipeline[]>([]);
  const [executions, setExecutions] = useState<HarnessPipelineExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const config = buildConfig(credentials.apiKey);
    setLoading(true);
    setError("");
    Promise.all([
      listPipelines(config, credentials.orgId, credentials.projectId),
      listPipelineExecutions(config, credentials.orgId, credentials.projectId),
    ])
      .then(([pList, eList]) => {
        setPipelines(pList);
        setExecutions(eList);
      })
      .catch(e => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [credentials]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  const failures = executions.filter(e => e.status?.toUpperCase() === "FAILED").length;
  const running = executions.filter(e => e.status?.toUpperCase() === "RUNNING").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          {credentials.orgId} / {credentials.projectId}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <GitBranch className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pipelines</span>
          </div>
          <div className="text-2xl font-bold">{pipelines.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Rocket className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Running</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{running}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Recent Failures</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{failures}</div>
        </div>
      </div>

      {/* Recent executions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Executions</h3>
          <button
            onClick={() => onNavigate("deployments")}
            className="text-xs text-primary underline"
          >
            View all
          </button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Pipeline</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Started</th>
              </tr>
            </thead>
            <tbody>
              {executions.slice(0, 5).map(exec => (
                <tr
                  key={exec.planExecutionId}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onNavigate("logs", { executionId: exec.planExecutionId })}
                  title="Click to view logs"
                >
                  <td className="px-4 py-2 font-mono text-xs">{exec.pipelineIdentifier}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={exec.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{fmt(exec.startTs)}</td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                    No executions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipelines list */}
      {pipelines.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Pipelines</h3>
            <button
              onClick={() => onNavigate("pipelines")}
              className="text-xs text-primary underline"
            >
              Edit pipelines
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Last Run</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.slice(0, 5).map(p => (
                  <tr key={p.identifier} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.identifier}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {p.executionSummaryInfo?.lastExecutionTs
                        ? fmt(p.executionSummaryInfo.lastExecutionTs)
                        : "Never"}
                    </td>
                    <td className="px-4 py-2">
                      {p.executionSummaryInfo?.lastExecutionStatus ? (
                        <StatusBadge status={p.executionSummaryInfo.lastExecutionStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
