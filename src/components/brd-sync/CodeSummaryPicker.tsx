import { useEffect, useMemo, useState } from "react";
import { Search, FileText, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPagesByLabel, type CodeSummaryPage } from "@/services/brdSyncApi";
import { CODE_SUMMARY_LABEL } from "./BRDSyncDashboard";

interface CodeSummaryPickerProps {
  spaceKey: string;
  selectedPageId: string | null;
  onSelect: (page: CodeSummaryPage) => void;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const CodeSummaryPicker = ({ spaceKey, selectedPageId, onSelect }: CodeSummaryPickerProps) => {
  const [pages, setPages] = useState<CodeSummaryPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadPages = () => {
    if (!spaceKey) return;
    setLoading(true);
    setError(null);
    fetchPagesByLabel(spaceKey, CODE_SUMMARY_LABEL, 100)
      .then(setPages)
      .catch((e) => setError(e?.message || "Failed to load code summaries"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Code Summaries</h3>
            <p className="text-xs text-muted-foreground">
              Published from the IDE via the code-summary MCP
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPages}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        )}
        {!loading && error && (
          <div className="m-4 p-4 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            {pages.length === 0 ? (
              <>
                <p className="mb-2 font-medium text-foreground">No code summaries yet.</p>
                <p>
                  In your IDE, run the <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">code-summary</code>{" "}
                  MCP and call <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">get_code_summary_template</code>.
                  See the Pair Programming page for setup.
                </p>
              </>
            ) : (
              <>No summaries match "{search}".</>
            )}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <ul className="divide-y">
            {filtered.map((page) => {
              const isSelected = page.page_id === selectedPageId;
              return (
                <li key={page.page_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(page)}
                    className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                      isSelected ? "bg-primary/5 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{page.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <span>v{page.version}</span>
                          <span>·</span>
                          <span>{formatDate(page.last_modified || page.created)}</span>
                        </div>
                      </div>
                      <a
                        href={page.web_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                        title="Open in Confluence"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
