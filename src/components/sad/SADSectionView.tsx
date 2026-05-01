/**
 * SADSectionView — renders one section's content blocks (paragraph,
 * heading, lists, table, diagram). Read-only view; edits happen via the
 * chat box.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageOff, RotateCcw } from "lucide-react";
import {
  getSadSection,
  fetchSadDiagramBlobUrl,
  sadRevertSection,
  type SADContentBlock,
  type SADSection,
} from "@/services/sadApi";

interface Props {
  sessionId: string;
  sectionNumber: number;
  /** Bumped after a chat-driven edit so we re-fetch */
  refreshKey?: number;
}

export function SADSectionView({ sessionId, sectionNumber, refreshKey }: Props) {
  const [section, setSection] = useState<SADSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSadSection(sessionId, sectionNumber)
      .then((s) => {
        if (!cancelled) setSection(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, sectionNumber, refreshKey]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading section…</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;
  if (!section) return <div className="p-4 text-sm text-muted-foreground">No section selected.</div>;

  const hasPriorVersion = (section.previous_versions?.length ?? 0) > 0;

  return (
    <article className="design-rise px-8 py-7 max-w-3xl mx-auto">
      <header
        className="flex items-start justify-between gap-4 pb-5 border-b"
        style={{ borderColor: "hsl(var(--design-rule-strong))" }}
      >
        <div className="min-w-0">
          <div className="design-eyebrow">
            Plate · {String(section.number).padStart(2, "0")} of 10
          </div>
          <h1 className="design-heading mt-1.5 text-3xl leading-tight">
            <span className="design-plate-num mr-3">
              {String(section.number).padStart(2, "0")}
            </span>
            {section.title}
          </h1>
          {section.audit && (
            <div className="design-eyebrow mt-2">
              Audit · {section.audit.score}
              {section.audit.issues?.length > 0 && ` · ${section.audit.issues.length} note(s)`}
            </div>
          )}
        </div>
        {hasPriorVersion && (
          <button
            type="button"
            className="design-btn-ghost"
            disabled={reverting}
            onClick={async () => {
              setReverting(true);
              try {
                await sadRevertSection(sessionId, sectionNumber);
                const fresh = await getSadSection(sessionId, sectionNumber);
                setSection(fresh);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setReverting(false);
              }
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Revert
          </button>
        )}
      </header>

      {section.audit?.issues?.length ? (
        <aside
          className="mt-5 design-plate design-plate--mark p-3"
          style={{ background: "hsl(var(--design-mark-soft))" }}
        >
          <div className="design-eyebrow mb-1.5">Audit notes</div>
          <ul className="space-y-1.5 text-[0.85rem]">
            {section.audit.issues.map((i, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span
                  className="design-mono text-xs uppercase shrink-0"
                  style={{ color: "hsl(var(--design-mark))" }}
                >
                  {i.code}
                </span>
                <span>{i.msg}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <div className="mt-6 space-y-4 leading-relaxed">
        {section.content.map((b, i) => (
          <RenderBlock key={i} block={b} sessionId={sessionId} />
        ))}
      </div>
    </article>
  );
}

function RenderBlock({ block, sessionId }: { block: SADContentBlock; sessionId: string }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-[0.95rem] leading-relaxed">{block.text}</p>;
    case "heading": {
      const Tag = (`h${Math.min(Math.max(block.level, 2), 5)}` as unknown) as keyof JSX.IntrinsicElements;
      return <Tag className="design-heading mt-2">{block.text}</Tag>;
    }
    case "ordered_list":
      return (
        <ol className="space-y-1.5 text-[0.92rem] pl-5 list-decimal">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ol>
      );
    case "bullet_list":
      return (
        <ul className="space-y-1.5 text-[0.92rem] pl-5 list-[square]">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="design-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="whitespace-pre-wrap">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "diagram": {
      // The s3_key is stored in JSON; the backend exposes it via /api/sad/{session_id}/diagram/logical
      // (v1 reuses logical for security/infrastructure). We read the kind from the alt or default to logical.
      const kind = block.alt?.toLowerCase().includes("security")
        ? "security"
        : block.alt?.toLowerCase().includes("infrastructure")
        ? "infrastructure"
        : "logical";
      return <DiagramBlock sessionId={sessionId} kind={kind} alt={block.alt} />;
    }
    default:
      return null;
  }
}

const DIAGRAM_KIND_LABEL: Record<string, string> = {
  logical: "Logical Architecture Diagram",
  security: "Security View Diagram",
  infrastructure: "Infrastructure Architecture Diagram",
};

/**
 * Renders the section-embedded diagram. The SVG endpoint is auth-gated
 * (`Depends(get_current_user)`), so we can't use a plain `<img src=URL>` —
 * the browser doesn't attach the bearer token to image requests. We fetch
 * the bytes via `apiGet`, blob them, and point the img at the blob URL.
 *
 * If the fetch fails (404 because the user saved XML only and SVG export
 * never ran, or 401), we swap to a labeled placeholder telling the user
 * which diagram is meant to live here.
 */
function DiagramBlock({
  sessionId,
  kind,
  alt,
}: {
  sessionId: string;
  kind: "logical" | "security" | "infrastructure" | string;
  alt?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const label = DIAGRAM_KIND_LABEL[kind] ?? alt ?? "Architecture Diagram";

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setErrored(false);
    setBlobUrl(null);
    fetchSadDiagramBlobUrl(sessionId, kind as any)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setBlobUrl(u);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessionId, kind]);

  if (errored) {
    return (
      <figure
        className="design-plate p-6 flex flex-col items-center justify-center text-center"
        style={{
          minHeight: "180px",
          background: "hsl(var(--design-paper-warm) / 0.45)",
          borderStyle: "dashed",
          borderColor: "hsl(var(--design-rule-strong) / 0.55)",
        }}
      >
        <ImageOff
          className="h-6 w-6 mb-2"
          style={{ color: "hsl(var(--design-ink-muted))" }}
        />
        <div className="design-eyebrow">Diagram placeholder</div>
        <div className="design-heading text-lg mt-1">{label}</div>
        <p
          className="design-marginalia mt-2 max-w-md"
          style={{ color: "hsl(var(--design-ink-soft))" }}
        >
          This is where the {label.toLowerCase()} belongs. Save a diagram in
          the Plate&nbsp;00 phase (with SVG export) and it will render here on
          the next read.
        </p>
      </figure>
    );
  }

  return (
    <figure className="design-plate p-3">
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={alt ?? label}
          className="w-full h-auto"
        />
      ) : (
        <div
          className="w-full"
          style={{
            minHeight: "120px",
            background:
              "repeating-linear-gradient(45deg, hsl(var(--design-rule) / 0.15) 0 8px, transparent 8px 16px)",
          }}
        />
      )}
      <figcaption className="design-eyebrow mt-2 text-center">
        Fig · {alt ?? label}
      </figcaption>
    </figure>
  );
}
